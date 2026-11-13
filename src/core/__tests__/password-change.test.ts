import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	passwordChangeErrorMessage,
	requiresPasswordChangeGate,
	validatePasswordChangeForm
} from '../auth/password-change';
import {
	ArcaneError,
	arcaneErrorFrom,
	isPasswordChangeRequiredError,
	passwordPolicyCode,
	passwordPolicyMessage,
	subscribeToArcaneResponseErrors
} from '../../sdk/errors/ArcaneError';

describe('requiresPasswordChangeGate', () => {
	it('gates users flagged for a password change outside the demo', () => {
		assert.equal(requiresPasswordChangeGate({ requiresPasswordChange: true }, false), true);
		assert.equal(requiresPasswordChangeGate({ requiresPasswordChange: false }, false), false);
		assert.equal(requiresPasswordChangeGate({ requiresPasswordChange: true }, true), false);
		assert.equal(requiresPasswordChangeGate(undefined, false), false);
	});
});

describe('validatePasswordChangeForm', () => {
	it('requires all fields and a matching confirmation', () => {
		assert.deepEqual(
			validatePasswordChangeForm({ currentPassword: '', newPassword: '', confirmPassword: '' }),
			{ canSubmit: false, hint: undefined }
		);
		assert.deepEqual(
			validatePasswordChangeForm({
				currentPassword: 'arcane-admin',
				newPassword: 'Correct-Horse-1',
				confirmPassword: 'Correct-Horse-1'
			}),
			{ canSubmit: true, hint: undefined }
		);
	});

	it('explains short, mismatched and unchanged passwords', () => {
		assert.equal(
			validatePasswordChangeForm({
				currentPassword: 'a',
				newPassword: 'short',
				confirmPassword: ''
			}).hint,
			'New password must be at least 8 characters.'
		);
		const mismatch = validatePasswordChangeForm({
			currentPassword: 'a',
			newPassword: 'long-enough',
			confirmPassword: 'long-enougH'
		});
		assert.equal(mismatch.canSubmit, false);
		assert.equal(mismatch.hint, "Passwords don't match.");
		const unchanged = validatePasswordChangeForm({
			currentPassword: 'arcane-admin',
			newPassword: 'arcane-admin',
			confirmPassword: 'arcane-admin'
		});
		assert.equal(unchanged.canSubmit, false);
	});
});

describe('passwordChangeErrorMessage', () => {
	it('reports a rejected current password', () => {
		assert.equal(
			passwordChangeErrorMessage(ArcaneError.unauthorized()),
			'Current password is incorrect.'
		);
	});
});

describe('password change required errors', () => {
	it('detects the Arcane error code', () => {
		const error = arcaneErrorFrom(
			403,
			JSON.stringify({
				code: 'PASSWORD_CHANGE_REQUIRED',
				message: 'password change required',
				statusCode: 403
			})
		);
		assert.equal(isPasswordChangeRequiredError(error), true);
	});

	it('detects the Huma problem response', () => {
		const error = arcaneErrorFrom(
			403,
			JSON.stringify({ title: 'Forbidden', status: 403, detail: 'password change required' })
		);
		assert.equal(isPasswordChangeRequiredError(error), true);
	});

	it('ignores other forbidden responses', () => {
		const error = arcaneErrorFrom(
			403,
			JSON.stringify({ title: 'Forbidden', status: 403, detail: 'missing permission' })
		);
		assert.equal(isPasswordChangeRequiredError(error), false);
		assert.equal(isPasswordChangeRequiredError(ArcaneError.unauthorized()), false);
	});

	it('notifies response error subscribers', () => {
		const seen: ArcaneError[] = [];
		const unsubscribe = subscribeToArcaneResponseErrors((error) => seen.push(error));
		arcaneErrorFrom(403, JSON.stringify({ detail: 'password change required' }));
		unsubscribe();
		arcaneErrorFrom(403, JSON.stringify({ detail: 'password change required' }));
		assert.equal(seen.length, 1);
	});
});

describe('password policy problems', () => {
	const policy = {
		minLength: 12,
		requireUppercase: true,
		requireLowercase: true,
		requireNumber: true,
		requireSymbol: true
	};

	it('formats the policy requirements', () => {
		assert.equal(
			passwordPolicyMessage(policy),
			'Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.'
		);
		assert.equal(
			passwordPolicyMessage({
				...policy,
				minLength: 8,
				requireUppercase: false,
				requireLowercase: false,
				requireSymbol: false
			}),
			'Password must be at least 8 characters and include a number.'
		);
		assert.equal(
			passwordPolicyMessage({
				...policy,
				minLength: 10,
				requireNumber: false,
				requireSymbol: false
			}),
			'Password must be at least 10 characters and include an uppercase letter and a lowercase letter.'
		);
		assert.equal(
			passwordPolicyMessage({
				minLength: 8,
				requireUppercase: false,
				requireLowercase: false,
				requireNumber: false,
				requireSymbol: false
			}),
			'Password must be at least 8 characters.'
		);
	});

	it('maps the problem response to a server message', () => {
		const error = arcaneErrorFrom(
			400,
			JSON.stringify({
				type: 'urn:arcane:problem:password-policy',
				title: 'Bad Request',
				status: 400,
				detail: 'newPassword: password must be at least 12 characters',
				details: { field: 'newPassword', policy }
			})
		);
		assert.equal(error.kind, 'server');
		assert.equal((error as { code?: string }).code, passwordPolicyCode);
		assert.equal(error.message, passwordPolicyMessage(policy));
	});

	it('falls back to the problem detail without a policy', () => {
		const error = arcaneErrorFrom(
			400,
			JSON.stringify({
				type: 'urn:arcane:problem:password-policy:strong',
				title: 'Bad Request',
				status: 400,
				detail: 'newPassword: password must be at least 12 characters'
			})
		);
		assert.equal(error.message, 'Password must be at least 12 characters');
	});
});
