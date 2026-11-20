import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { parseGoogleServices, validateFirebaseSettings } from '../firebase-config';

const file = JSON.stringify({
	project_info: { project_number: '123456789', project_id: 'demo' },
	client: [
		{
			client_info: {
				mobilesdk_app_id: '1:123456789:android:aaaa1111',
				android_client_info: { package_name: 'com.example.other' }
			},
			api_key: [{ current_key: 'other-key' }]
		},
		{
			client_info: {
				mobilesdk_app_id: '1:123456789:android:bbbb2222',
				android_client_info: { package_name: 'com.example.arcane' }
			},
			api_key: [{ current_key: 'arcane-key' }]
		}
	]
});

describe('parseGoogleServices', () => {
	it('picks the client that matches the package name', () => {
		const result = parseGoogleServices(file, 'com.example.arcane');
		assert.deepEqual(result, {
			ok: true,
			settings: {
				projectId: 'demo',
				applicationId: '1:123456789:android:bbbb2222',
				apiKey: 'arcane-key',
				senderId: '123456789'
			}
		});
	});

	it('rejects a file without the package', () => {
		const result = parseGoogleServices(file, 'com.example.missing');
		assert.equal(result.ok, false);
	});

	it('rejects text that is not JSON', () => {
		assert.equal(parseGoogleServices('nope', 'com.example.arcane').ok, false);
	});

	it('rejects JSON that is not a google-services file', () => {
		assert.equal(parseGoogleServices('{"a":1}', 'com.example.arcane').ok, false);
	});
});

describe('validateFirebaseSettings', () => {
	const valid = {
		projectId: 'demo',
		applicationId: '1:123456789:android:bbbb2222',
		apiKey: 'key',
		senderId: '123456789'
	};

	it('accepts matching values', () => {
		assert.equal(validateFirebaseSettings(valid), undefined);
	});

	it('requires every value', () => {
		assert.ok(validateFirebaseSettings({ ...valid, apiKey: ' ' }));
		assert.ok(validateFirebaseSettings({ ...valid, projectId: '' }));
	});

	it('rejects a sender ID that differs from the app ID', () => {
		assert.ok(validateFirebaseSettings({ ...valid, senderId: '999' }));
	});

	it('rejects a malformed app ID', () => {
		assert.ok(validateFirebaseSettings({ ...valid, applicationId: 'abc' }));
	});
});
