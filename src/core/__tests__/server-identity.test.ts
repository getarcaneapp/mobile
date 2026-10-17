import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	canonicalServerOrigin,
	escapedPathComponent,
	hostAndPort,
	isPublicIPAddress,
	isSameOrigin,
	normalizeServerURLInput,
	serverCacheIdentity
} from '../networking/server-identity';

describe('normalizeServerURLInput (configure(serverURL:))', () => {
	it('defaults to https and trims', () => {
		assert.equal(normalizeServerURLInput('  arcane.example.com  '), 'https://arcane.example.com');
	});
	it('keeps an explicit http scheme, case-insensitively', () => {
		assert.equal(normalizeServerURLInput('HTTP://10.0.0.5:3552'), 'HTTP://10.0.0.5:3552');
	});
	it('rejects input without a host or with spaces', () => {
		assert.equal(normalizeServerURLInput(''), undefined);
		assert.equal(normalizeServerURLInput('https://'), undefined);
		assert.equal(normalizeServerURLInput('my server.local'), undefined);
	});
});

describe('canonicalServerOrigin', () => {
	it('spells out the default port and strips trailing slashes', () => {
		assert.equal(
			canonicalServerOrigin('https://Arcane.Example.com./'),
			'https://arcane.example.com:443'
		);
		assert.equal(canonicalServerOrigin('http://host/base//'), 'http://host:80/base');
	});
	it('rejects non-http schemes', () => {
		assert.equal(canonicalServerOrigin('ftp://host'), undefined);
	});
});

describe('serverCacheIdentity', () => {
	it('always ends in a slash with the effective port', () => {
		assert.equal(serverCacheIdentity('https://Host'), 'https://host:443/');
		assert.equal(serverCacheIdentity('http://host:8080/arcane'), 'http://host:8080/arcane/');
	});
});

describe('isSameOrigin', () => {
	it('treats default ports and trailing dots as equal', () => {
		assert.ok(isSameOrigin('https://host./a', 'https://HOST:443/b'));
		assert.ok(!isSameOrigin('https://host', 'http://host'));
		assert.ok(!isSameOrigin('https://host:8443', 'https://host'));
	});
});

describe('misc', () => {
	it("escapes path components like urlPathAllowed minus '/'", () => {
		assert.equal(escapedPathComponent('a b/c'), 'a%20b%2Fc');
		assert.equal(escapedPathComponent('user@x'), 'user@x');
	});
	it('formats host and port', () => {
		assert.equal(hostAndPort('https://demo.example.com:8443/x'), 'demo.example.com:8443');
	});
	it('classifies public addresses', () => {
		assert.ok(isPublicIPAddress('8.8.8.8'));
		assert.ok(!isPublicIPAddress('192.168.1.2'));
		assert.ok(!isPublicIPAddress('100.64.0.1'));
		assert.ok(!isPublicIPAddress('fd00::1'));
		assert.ok(!isPublicIPAddress('::ffff:10.0.0.1'));
		assert.ok(isPublicIPAddress('2606:4700::1111'));
	});
});
