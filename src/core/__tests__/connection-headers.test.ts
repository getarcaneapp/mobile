import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	ConnectionHeaderValidationError,
	ConnectionHeaders,
	ConnectionHeadersRecord
} from '../connection-profiles/connection-headers';
import type { ConnectionProfile } from '../connection-profiles/connection-profile-sync';
import { ProxyRequestSupport } from '../../sdk/client/proxyRequestSupport';

const profile: ConnectionProfile = {
	id: 'P1',
	name: 'Home',
	serverURL: 'https://arcane.example.com',
	modifiedAt: 1_000
};

const kindOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		assert.ok(error instanceof ConnectionHeaderValidationError);
		return error.kind;
	}
	return undefined;
};

describe('ConnectionHeaders.make', () => {
	it('trims entries and drops blank rows', () => {
		assert.deepEqual(
			ConnectionHeaders.make([
				{ name: ' CF-Access-Client-Id ', value: ' abc.access ' },
				{ name: '', value: '  ' },
				{ name: 'CF-Access-Client-Secret', value: 'secret' }
			]),
			[
				{ name: 'CF-Access-Client-Id', value: 'abc.access' },
				{ name: 'CF-Access-Client-Secret', value: 'secret' }
			]
		);
	});

	it('rejects incomplete, invalid, reserved and duplicate headers', () => {
		assert.equal(
			kindOf(() => ConnectionHeaders.make([{ name: '', value: 'x' }])),
			'emptyName'
		);
		assert.equal(
			kindOf(() => ConnectionHeaders.make([{ name: 'P-Access-Token', value: '' }])),
			'emptyValue'
		);
		assert.equal(
			kindOf(() => ConnectionHeaders.make([{ name: 'Bad Name:', value: 'x' }])),
			'invalidName'
		);
		assert.equal(
			kindOf(() => ConnectionHeaders.make([{ name: 'X-Token', value: 'a\nb' }])),
			'invalidValue'
		);
		for (const name of ['Authorization', 'cookie', 'X-API-Key', 'X-Arcane-Batch-Id', 'Host']) {
			assert.equal(
				kindOf(() => ConnectionHeaders.make([{ name, value: 'x' }])),
				'reservedName'
			);
		}
		assert.equal(
			kindOf(() =>
				ConnectionHeaders.make([
					{ name: 'X-Token', value: 'a' },
					{ name: 'x-token', value: 'b' }
				])
			),
			'duplicateName'
		);
		assert.equal(
			kindOf(() =>
				ConnectionHeaders.make([
					{ name: 'X-Token', value: 'x'.repeat(ConnectionHeaders.maximumValueBytes + 1) }
				])
			),
			'valueTooLarge'
		);
		assert.equal(
			kindOf(() =>
				ConnectionHeaders.make(
					Array.from({ length: ConnectionHeaders.maximumCount + 1 }, (_, index) => ({
						name: `X-Token-${index}`,
						value: 'x'
					}))
				)
			),
			'tooManyHeaders'
		);
	});
});

describe('ConnectionHeadersRecord', () => {
	const record = ConnectionHeadersRecord.make(profile, [
		{ name: 'P-Access-Token-Id', value: 'id' },
		{ name: 'P-Access-Token', value: 'token' }
	]);

	it('round-trips through JSON', () => {
		assert.deepEqual(ConnectionHeadersRecord.decode(JSON.parse(JSON.stringify(record))), record);
	});

	it('only yields headers for the profile and server it was saved for', () => {
		assert.deepEqual(ConnectionHeadersRecord.headers(record, profile), record.headers);
		assert.equal(ConnectionHeadersRecord.headers(record, { ...profile, id: 'P2' }), undefined);
		assert.equal(
			ConnectionHeadersRecord.headers(record, { ...profile, serverURL: 'https://other.example' }),
			undefined
		);
	});

	it('rejects malformed stored records', () => {
		assert.throws(() => ConnectionHeadersRecord.decode({ ...record, version: 2 }));
		assert.throws(() => ConnectionHeadersRecord.decode({ ...record, headers: [] }));
		assert.throws(() => ConnectionHeadersRecord.decode({ ...record, headers: [{ name: 'A' }] }));
		assert.throws(() =>
			ConnectionHeadersRecord.decode({ ...record, serverURL: 'HTTPS://Arcane.example.com/' })
		);
	});
});

describe('ProxyRequestSupport custom headers', () => {
	const support = new ProxyRequestSupport('https://arcane.example.com/base', {
		'CF-Access-Client-Id': 'id',
		Authorization: 'Basic nope'
	});

	it('sends allowed headers to the server only', () => {
		assert.deepEqual(support.headers('https://arcane.example.com/base/api/health'), {
			'CF-Access-Client-Id': 'id'
		});
		assert.deepEqual(support.headers('wss://arcane.example.com/base/api/ws'), {
			'CF-Access-Client-Id': 'id'
		});
		assert.deepEqual(support.headers('https://evil.example.com/base/api/health'), {});
		assert.deepEqual(support.headers('https://arcane.example.com/other'), {});
	});
});
