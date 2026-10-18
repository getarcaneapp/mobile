import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { appendingAPIPath, withQueryItems } from '../client/url';
import { ProxyRequestSupport } from '../client/proxyRequestSupport';
import { ServerCapabilities } from '../client/ServerCapabilities';
import {
	arcaneErrorFrom,
	ArcaneServerError,
	ArcaneValidationError,
	isArcaneError
} from '../errors/ArcaneError';
import { parseArcaneJSON } from '../http/json';
import { AuthenticationResult } from '../models/auth/Login';
import { parseArcaneDate } from '../models/base/date';
import { User } from '../models/user/User';
import { decodeNDJSONLine, lines } from '../streaming/NDJSONStream';
import { OperationStreamEvent } from '../types/streaming/OperationStreamEvent';

describe('User.decode (v1 / v2 tolerance)', () => {
	it('decodes a v1 user with defaults for missing keys', () => {
		const user = User.decode(
			parseArcaneJSON('{"id":"u1","username":"kyle","roles":["admin"],"email":null}')
		);
		assert.deepEqual(user.roles, ['admin']);
		assert.equal(user.canDelete, false);
		assert.equal(user.requiresPasswordChange, false);
		assert.equal(user.email, undefined);
		assert.equal(ServerCapabilities.detect(user), 'legacyRoles');
	});

	it('synthesizes deduped roles from v2 role assignments and maps isGlobalAdmin', () => {
		const user = User.decode({
			id: 'u2',
			username: 'ops',
			roleAssignments: [
				{ roleId: 'role_admin', source: 'manual' },
				{ roleId: 'role_viewer', environmentId: '1', source: 'oidc' },
				{ roleId: 'role_admin', environmentId: '2', source: 'manual' }
			],
			permissionsByEnv: { global: ['*'], '1': ['containers:read'] },
			isGlobalAdmin: true
		});
		assert.deepEqual(user.roles, ['role_admin', 'role_viewer']);
		assert.equal(user.serverIsGlobalAdmin, true);
		assert.deepEqual(user.permissionsByEnv?.['1'], ['containers:read']);
		assert.equal(ServerCapabilities.detect(user), 'rbac');
		assert.equal(User.encode(user).isGlobalAdmin, true);
	});

	it('rejects a payload missing a required key', () => {
		assert.throws(() => User.decode({ username: 'x' }), /id/);
	});
});

describe('AuthenticationResult.decode', () => {
	const user = { id: 'u1', username: 'kyle' };

	it('decodes an authenticated login', () => {
		const result = AuthenticationResult.decode({
			token: 't',
			refreshToken: 'r',
			expiresAt: '2026-01-01T00:00:00Z',
			user
		});
		assert.equal(result.kind, 'authenticated');
		if (result.kind === 'authenticated') assert.equal(result.value.user.username, 'kyle');
	});

	it('accepts the challenge under `mfa`, `challenge`, or inline, defaulting method/options', () => {
		const challenge = { transactionId: 'tx', expiresAt: '2026-01-01T00:00:00Z' };
		for (const body of [
			{ status: 'mfa_required', mfa: challenge },
			{ status: 'mfa_required', challenge },
			{ status: 'mfa_required', ...challenge }
		]) {
			const result = AuthenticationResult.decode(body);
			assert.equal(result.kind, 'mfaRequired');
			if (result.kind === 'mfaRequired') {
				assert.equal(result.value.transactionId, 'tx');
				assert.equal(result.value.method, 'passkey');
				assert.deepEqual(result.value.options, {});
			}
		}
	});

	it("rejects unknown statuses like Swift's Status enum", () => {
		assert.throws(() => AuthenticationResult.decode({ status: 'weird' }));
	});
});

describe('dates', () => {
	it('parses RFC 3339 with and without fractional seconds, including nanoseconds', () => {
		assert.equal(
			parseArcaneDate('2024-05-06T07:08:09Z')?.toISOString(),
			'2024-05-06T07:08:09.000Z'
		);
		assert.equal(
			parseArcaneDate('2024-05-06T07:08:09.123456789Z')?.toISOString(),
			'2024-05-06T07:08:09.123Z'
		);
		assert.equal(
			parseArcaneDate('2024-05-06T07:08:09.5+02:00')?.toISOString(),
			'2024-05-06T05:08:09.500Z'
		);
		assert.equal(parseArcaneDate('yesterday'), undefined);
	});
});

describe('errors', () => {
	it('maps Arcane and Huma error bodies like ArcaneError.from', () => {
		const server = arcaneErrorFrom(500, '{"success":false,"error":"boom","code":"DOCKER"}');
		assert.ok(server instanceof ArcaneServerError);
		assert.equal(server.code, 'DOCKER');
		assert.equal(server.serverMessage, 'boom');

		const validation = arcaneErrorFrom(
			422,
			'{"title":"Unprocessable","status":422,"errors":[{"message":"required","location":"body.name"}]}'
		);
		assert.ok(validation instanceof ArcaneValidationError);
		assert.deepEqual(validation.fields, { name: ['required'] });

		const limited = arcaneErrorFrom(429, '', new Headers({ 'Retry-After': '7' }));
		assert.ok(isArcaneError(limited, 'rateLimited'));
		assert.equal(limited.retryAfter, 7);
		assert.ok(isArcaneError(arcaneErrorFrom(418, 'teapot'), 'unknown'));
	});
});

describe('URLs and proxy scope', () => {
	it('inserts /api once and keeps query order', () => {
		assert.equal(
			appendingAPIPath('https://h.test', '/environments/0/containers/'),
			'https://h.test/api/environments/0/containers'
		);
		assert.equal(
			appendingAPIPath('https://h.test/arcane/api/', 'auth/me'),
			'https://h.test/arcane/api/auth/me'
		);
		assert.equal(
			withQueryItems('https://h.test/api/x', [
				{ name: 'a', value: '1 2' },
				{ name: 'a', value: '3' }
			]),
			'https://h.test/api/x?a=1%202&a=3'
		);
	});

	it('scopes requests to the base URL', () => {
		const support = new ProxyRequestSupport('https://h.test/arcane');
		assert.equal(support.contains('https://h.test/arcane/api/auth/me'), true);
		assert.equal(support.contains('wss://h.test:443/arcane/api/ws'), true);
		assert.equal(support.contains('https://h.test/other'), false);
		assert.equal(support.contains('https://evil.test/arcane/api'), false);
		assert.equal(support.contains('https://h.test/arcane/../x'), false);
	});
});

describe('NDJSON', () => {
	it('skips heartbeats, unwraps SSE data lines and rejects malformed JSON', () => {
		assert.equal(decodeNDJSONLine('  '), undefined);
		assert.equal(decodeNDJSONLine(': heartbeat'), undefined);
		assert.equal(decodeNDJSONLine('data: {"done":true}', OperationStreamEvent.decode)?.done, true);
		assert.throws(
			() => decodeNDJSONLine('{"done":'),
			(error) => isArcaneError(error, 'decoding')
		);
	});

	it('splits lines across chunk boundaries', async () => {
		const encoder = new TextEncoder();
		async function* chunks() {
			yield encoder.encode('{"a":1}\r');
			yield encoder.encode('\n{"a":');
			yield encoder.encode('2}\n{"a":3}');
		}
		const out: string[] = [];
		for await (const line of lines(chunks())) out.push(line);
		assert.deepEqual(out, ['{"a":1}', '{"a":2}', '{"a":3}']);
	});

	it('maps operation terminal frames', () => {
		assert.equal(OperationStreamEvent.terminalAction({ done: true }).kind, 'finish');
		const fail = OperationStreamEvent.terminalAction({ error: ' pull failed ' });
		assert.equal(fail.kind, 'fail');
		if (fail.kind === 'fail')
			assert.equal((fail.error as ArcaneServerError).serverMessage, 'pull failed');
		assert.equal(OperationStreamEvent.terminalAction({ log: 'x' }).kind, 'continueStreaming');
	});
});

describe('fast JSON and line parsing', () => {
	const reviverParse = (text: string) =>
		JSON.parse(text, function (this: unknown, _key: string, value: unknown) {
			if (value === null && !Array.isArray(this)) return undefined;
			return value;
		});

	it('matches the null-stripping reviver', () => {
		const samples = [
			'{"a":1,"b":null,"c":{"d":null,"e":[null,1,{"f":null,"g":"null"}]}}',
			'[null,{"a":null},[null]]',
			'{"text":"no nulls here","n":0,"empty":{},"list":[]}',
			'"null"',
			'42',
			'null',
			'{"nested":{"deeper":{"deepest":null,"keep":false}}}'
		];
		for (const text of samples) assert.deepEqual(parseArcaneJSON(text), reviverParse(text));
		assert.equal(parseArcaneJSON('null'), undefined);
		assert.ok(!('b' in (parseArcaneJSON('{"a":1,"b":null}') as object)));
	});

	it('splits every separator style and waits on a trailing carriage return', async () => {
		const encoder = new TextEncoder();
		async function* chunks() {
			yield encoder.encode('one\ntwo\r\nthree\rfour\r');
			yield encoder.encode('\nfive\n\nsix');
		}
		const out: string[] = [];
		for await (const line of lines(chunks())) out.push(line);
		assert.deepEqual(out, ['one', 'two', 'three', 'four', 'five', '', 'six']);
	});
});
