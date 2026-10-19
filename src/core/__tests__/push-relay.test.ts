import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	installationRequestBody,
	isUnsupportedPlatformError,
	pushPlatformFor,
	tokenUpdateBody
} from '../push-relay';

describe('pushPlatformFor', () => {
	it('maps each OS to its push service', () => {
		assert.equal(pushPlatformFor('ios'), 'apns');
		assert.equal(pushPlatformFor('android'), 'fcm');
		assert.equal(pushPlatformFor('web'), undefined);
	});
});

describe('installationRequestBody', () => {
	it('sends the APNs environment for iOS', () => {
		assert.deepEqual(installationRequestBody('apns', 'abc123', 'sandbox', '1.0.0'), {
			platform: 'apns',
			apnsEnvironment: 'sandbox',
			deviceToken: 'abc123',
			appVersion: '1.0.0'
		});
	});

	it('leaves the APNs environment out for Android', () => {
		assert.deepEqual(installationRequestBody('fcm', 'tok:AbC_1-2', '', '1.0.0'), {
			platform: 'fcm',
			deviceToken: 'tok:AbC_1-2',
			appVersion: '1.0.0'
		});
	});
});

describe('tokenUpdateBody', () => {
	it('matches the installation platform', () => {
		assert.deepEqual(tokenUpdateBody('apns', 'abc123', 'production'), {
			deviceToken: 'abc123',
			apnsEnvironment: 'production'
		});
		assert.deepEqual(tokenUpdateBody('fcm', 'tok:AbC_1-2', ''), { deviceToken: 'tok:AbC_1-2' });
	});
});

describe('isUnsupportedPlatformError', () => {
	it('recognizes a relay without the platform enabled', () => {
		assert.equal(isUnsupportedPlatformError(400, 'platform "fcm" is not supported'), true);
		assert.equal(isUnsupportedPlatformError(400, 'deviceToken must be a hex string'), false);
		assert.equal(isUnsupportedPlatformError(500, 'platform "fcm" is not supported'), false);
	});
});
