import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	ConnectionCredentialRecord,
	ConnectionProfilePayload,
	ConnectionProfileSync,
	ConnectionProfileValidationError,
	SavedConnectionCredential,
	type ConnectionProfileRecord
} from '../connection-profiles/connection-profile-sync';

const record = (
	overrides: Partial<ConnectionProfileRecord> & { id: string }
): ConnectionProfileRecord => ({
	name: 'Server',
	serverURL: 'https://a.example.com',
	modifiedAt: 1_000,
	revision: 'R1',
	isDeleted: false,
	...overrides
});

describe('normalizedServerURL', () => {
	it('canonicalizes scheme, host, default port, path, credentials, query, fragment', () => {
		assert.equal(
			ConnectionProfileSync.normalizedServerURL(
				'  HTTPS://user:pw@Arcane.Example.com:443/base///?q=1#x '
			),
			'https://arcane.example.com/base'
		);
		assert.equal(ConnectionProfileSync.normalizedServerURL('example.com/'), 'https://example.com');
		assert.equal(
			ConnectionProfileSync.normalizedServerURL('http://10.0.0.2:80'),
			'http://10.0.0.2'
		);
		assert.equal(
			ConnectionProfileSync.normalizedServerURL('http://10.0.0.2:3552'),
			'http://10.0.0.2:3552'
		);
	});
	it('rejects unsupported schemes and empty input', () => {
		assert.throws(
			() => ConnectionProfileSync.normalizedServerURL('ftp://x'),
			(e: unknown) =>
				e instanceof ConnectionProfileValidationError && e.kind === 'unsupportedScheme'
		);
		assert.throws(
			() => ConnectionProfileSync.normalizedServerURL('   '),
			ConnectionProfileValidationError
		);
	});
});

describe('sanitizedName', () => {
	it('collapses whitespace, drops control characters, caps at 60, falls back to host', () => {
		assert.equal(
			ConnectionProfileSync.sanitizedName(' Home\n\tLab\u0007 ', 'https://x'),
			'Home Lab'
		);
		assert.equal(ConnectionProfileSync.sanitizedName('', 'https://host.lan:8443'), 'host.lan:8443');
		assert.equal(ConnectionProfileSync.sanitizedName('x'.repeat(80), 'https://x').length, 60);
	});
});

describe('merge', () => {
	it('keeps the newer record per id and prefers tombstones on ties', () => {
		const local = { version: 1, records: [record({ id: 'A', name: 'Old', modifiedAt: 1 })] };
		const remote = { version: 1, records: [record({ id: 'A', name: 'New', modifiedAt: 2 })] };
		assert.equal(ConnectionProfileSync.merge(local, remote).records[0]?.name, 'New');
		const deleted = { version: 1, records: [record({ id: 'A', modifiedAt: 1, isDeleted: true })] };
		assert.equal(ConnectionProfileSync.merge(local, deleted).records[0]?.isDeleted, true);
	});
	it('tombstones duplicates of the same server, keeping the newest', () => {
		const merged = ConnectionProfileSync.merge(
			{
				version: 1,
				records: [
					record({ id: 'A', serverURL: 'https://same.example.com', modifiedAt: 5 }),
					record({ id: 'B', serverURL: 'HTTPS://Same.Example.com/', modifiedAt: 9 })
				]
			},
			ConnectionProfilePayload.empty
		);
		const active = ConnectionProfileSync.activeProfiles(merged);
		assert.deepEqual(
			active.map((p) => p.id),
			['B']
		);
		assert.equal(merged.records.find((r) => r.id === 'A')?.modifiedAt, 9);
	});
	it('retires malformed records and caps active profiles at 25', () => {
		const records = Array.from({ length: 27 }, (_, i) =>
			record({
				id: `ID${String(i).padStart(2, '0')}`,
				serverURL: `https://h${i}.example.com`,
				modifiedAt: i
			})
		);
		records.push(record({ id: 'BAD', serverURL: 'ftp://nope' }));
		const merged = ConnectionProfileSync.merge(
			{ version: 1, records },
			ConnectionProfilePayload.empty
		);
		assert.equal(ConnectionProfileSync.activeProfiles(merged).length, 25);
		assert.equal(merged.records.find((r) => r.id === 'BAD')?.isDeleted, true);
		assert.equal(merged.records.find((r) => r.id === 'ID00')?.isDeleted, true);
		assert.deepEqual(
			merged.records.map((r) => r.id),
			merged.records.map((r) => r.id).sort()
		);
	});
	it('sorts active profiles by name, then URL', () => {
		const merged = ConnectionProfileSync.merge(
			{
				version: 1,
				records: [
					record({ id: '1', name: 'beta', serverURL: 'https://b.example.com' }),
					record({ id: '2', name: 'Alpha', serverURL: 'https://a.example.com' })
				]
			},
			ConnectionProfilePayload.empty
		);
		assert.deepEqual(
			ConnectionProfileSync.activeProfiles(merged).map((p) => p.name),
			['Alpha', 'beta']
		);
	});
});

describe('credentials', () => {
	const profile = { id: 'P', name: 'Home', serverURL: 'https://home.example.com', modifiedAt: 0 };
	it('rejects partial sign-ins but allows none', () => {
		assert.equal(SavedConnectionCredential.optional('', ''), undefined);
		assert.throws(() => SavedConnectionCredential.optional('admin', ''));
	});
	it('binds a record to its profile and server', () => {
		const rec = ConnectionCredentialRecord.make(profile, 'admin', 'secret');
		assert.deepEqual(ConnectionCredentialRecord.credential(rec, profile), {
			username: 'admin',
			password: 'secret'
		});
		assert.equal(
			ConnectionCredentialRecord.credential(rec, {
				...profile,
				serverURL: 'https://other.example.com'
			}),
			undefined
		);
		assert.deepEqual(ConnectionCredentialRecord.decode(JSON.parse(JSON.stringify(rec))), rec);
		assert.throws(() =>
			ConnectionCredentialRecord.decode({ ...rec, serverURL: 'HTTPS://Home.example.com/' })
		);
	});
});
