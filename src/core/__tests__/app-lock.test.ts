import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { AppLockGrace, biometryTitle, shouldLockOnResume } from '../app-lock/app-lock-policy';

describe('shouldLockOnResume', () => {
	it('never locks when disabled or not backgrounded', () => {
		assert.equal(shouldLockOnResume(false, 0, 10_000, 0), false);
		assert.equal(shouldLockOnResume(true, undefined, 10_000, 0), false);
	});

	it('locks once the grace period has passed', () => {
		assert.equal(shouldLockOnResume(true, 1_000, 1_000, 0), true);
		assert.equal(shouldLockOnResume(true, 0, 59_999, 60), false);
		assert.equal(shouldLockOnResume(true, 0, 60_000, 60), true);
	});
});

describe('AppLockGrace', () => {
	it('titles and normalizes choices', () => {
		assert.equal(AppLockGrace.title(0), 'Immediately');
		assert.equal(AppLockGrace.title(60), 'After 1 minute');
		assert.equal(AppLockGrace.title(900), 'After 15 minutes');
		assert.equal(AppLockGrace.from(300), 300);
		assert.equal(AppLockGrace.from(42), 0);
		assert.equal(AppLockGrace.from(undefined), 0);
	});
});

describe('biometryTitle', () => {
	it('names the platform method', () => {
		assert.equal(biometryTitle('faceID', 'ios'), 'Face ID');
		assert.equal(biometryTitle('none', 'ios'), 'Passcode');
		assert.equal(biometryTitle('fingerprint', 'android'), 'Fingerprint');
		assert.equal(biometryTitle('none', 'android'), 'Screen Lock');
	});
});
