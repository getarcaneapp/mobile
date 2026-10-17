// Port of ComposeDocumentTests.swift and ComposeScreenshotIntegrationTests.swift.
import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { ComposeDocument } from '../model/compose-document';

const doc = (source: string) => ComposeDocument.parse(source);
const replacing = (source: string, of: string, withText: string) => source.split(of).join(withText);

describe('ComposeDocument', () => {
	it('repeated parses return the same document and errors', () => {
		const source = 'services:\n  web:\n    image: nginx\n';
		const first = doc(source);
		const second = doc(source);
		assert.equal(first.source, second.source);
		assert.equal(second.scalar(['services', 'web', 'image']), 'nginx');
		const edited = first.setting('alpine', ['services', 'web', 'image']);
		assert.equal(doc(edited).scalar(['services', 'web', 'image']), 'alpine');
		assert.throws(() => doc('services: [\n'));
		assert.throws(() => doc('services: [\n'));
	});

	it('no-op preserves every byte', () => {
		const source =
			"# header\r\nservices:\r\n  web:\r\n    image: 'nginx:latest' # keep\r\nx-extra: ${VALUE}\r\n";
		const document = doc(source);
		assert.equal(document.source, source);
		assert.equal(
			document.setting(ComposeDocument.quoted('nginx:latest'), ['services', 'web', 'image']),
			source
		);
	});

	it('scalar edit preserves unicode, comments and extensions', () => {
		const source =
			'# 🐳\nservices:\n  web:\n    image: nginx # pin\n    labels:\n      title: café\nx-extra: ${KEEP}\n';
		const changed = doc(source).setting('alpine', ['services', 'web', 'image']);
		assert.equal(changed, replacing(source, 'image: nginx', 'image: alpine'));
		assert.equal(doc(changed).scalar(['services', 'web', 'labels', 'title']), 'café');
	});

	it('sequence edit preserves other rows and comments', () => {
		const source =
			"services:\n  web:\n    ports:\n      - '80:80' # first\n      - '443:443' # secure\n";
		const document = doc(source);
		assert.deepEqual(document.items(['services', 'web', 'ports']), ["'80:80'", "'443:443'"]);
		assert.equal(
			document.settingItem("'8080:80'", ['services', 'web', 'ports'], 0),
			replacing(source, "'80:80'", "'8080:80'")
		);
	});

	it('malformed and duplicate keys are rejected', () => {
		assert.throws(() => doc('services: [broken'));
		assert.throws(() => doc('services:\n  web: {}\n  web: {}\n'));
	});

	it('anchors and merges remain untouched', () => {
		const source =
			'x-base: &base\n  image: nginx\nservices:\n  web:\n    <<: *base\n  other:\n    image: alpine\n';
		const document = doc(source);
		assert.ok(!document.isEditable(['services', 'web', 'image']));
		assert.throws(() => document.setting('busybox', ['services', 'web', 'image']));
		const changed = document.setting('busybox', ['services', 'other', 'image']);
		assert.equal(changed, replacing(source, 'image: alpine', 'image: busybox'));
	});

	it('additions and removal retain CRLF', () => {
		const source =
			'services:\r\n  web:\r\n    image: nginx\r\n    restart: always\r\nx-keep: true\r\n';
		const added = doc(source).setting("'80:80'", ['services', 'web', 'command']);
		assert.ok(added.includes('    "command": \'80:80\'\r\n'));
		assert.ok(!added.split('\r\n').join('').includes('\n'));
		const removed = doc(source).removing(['services', 'web', 'restart']);
		assert.equal(removed, replacing(source, '    restart: always\r\n', ''));
	});

	it('adds service and nested fields', () => {
		const added = doc('services:\n  web:\n    image: nginx\n').setting('image: postgres', [
			'services',
			'db'
		]);
		assert.deepEqual(doc(added).services, ['web', 'db']);
		assert.equal(doc(added).scalar(['services', 'db', 'image']), 'postgres');
	});

	for (const source of ['services: {}\n', 'services:\n', '']) {
		it(`fills empty mappings: ${JSON.stringify(source)}`, () => {
			const changed = doc(source).setting('image: nginx', ['services', 'web']);
			assert.equal(doc(changed).scalar(['services', 'web', 'image']), 'nginx');
		});
	}

	it('sequence append, remove and empty reuse', () => {
		const path = ['services', 'web', 'ports'];
		const source = "services:\n  web:\n    image: nginx\n    ports:\n      - '80:80' # keep\n";
		const appended = doc(source).appendingItem("'443:443'", path);
		assert.ok(appended.includes("- '80:80' # keep\n"));
		assert.equal(doc(appended).items(path)?.length, 2);
		const removed = doc(appended).removingItem(path, 1);
		assert.equal(doc(removed).items(path)?.length, 1);
		const empty = doc(removed).removingItem(path, 0);
		assert.ok(doc(empty).isEditable(path));
		assert.deepEqual(doc(empty).items(path), []);
		const refilled = doc(empty).appendingItem("'8080:80'", path);
		assert.deepEqual(doc(refilled).items(path), ["'8080:80'"]);
	});

	it('unsupported structures fail closed', () => {
		for (const source of [
			'services:\n  web: {image: nginx}\n',
			'services:\n  web: &web\n    image: nginx\n',
			'services:\n  web: !custom\n    image: nginx\n'
		]) {
			const document = doc(source);
			assert.throws(
				() => document.setting('alpine', ['services', 'web', 'image']),
				undefined,
				source
			);
		}
	});

	it('removing the last service allows adding another', () => {
		const source = 'services:\n  web:\n    image: nginx\nx-extra: true\n';
		const removed = doc(source).removing(['services', 'web']);
		const added = doc(removed).setting('image: alpine', ['services', 'other']);
		assert.deepEqual(doc(added).services, ['other']);
		assert.ok(added.includes('x-extra: true'));
	});

	it('healthcheck flow sequence preserves screenshot fields', () => {
		const source = [
			'# deployment',
			'services:',
			'  arcane:',
			'    image: ghcr.io/getarcaneapp/arcane:latest',
			'    container_name: arcane',
			'    restart: unless-stopped',
			'    ports:',
			'      - "3552:3552"',
			'    volumes:',
			'      - /var/run/docker.sock:/var/run/docker.sock',
			'      - arcane-data:/app/data',
			'    environment:',
			'      APP_URL: https://arcane.example.test',
			'      ENCRYPTION_KEY: ${ENCRYPTION_KEY}',
			'      JWT_SECRET: ${JWT_SECRET}',
			'    healthcheck:',
			'      test: ["CMD", "/app/arcane", "health"] # keep',
			'      interval: 30s',
			'      timeout: 10s',
			'      retries: 3',
			'      start_period: 10s',
			'volumes:',
			'  arcane-data:'
		].join('\n');
		const path = ['services', 'arcane', 'healthcheck', 'test'];
		const document = doc(source);
		assert.ok(document.isEditable(['services', 'arcane']));
		assert.deepEqual(document.items(path), ['"CMD"', '"/app/arcane"', '"health"']);
		assert.equal(
			document.settingItem('"status"', path, 2),
			replacing(source, '"health"', '"status"')
		);
		assert.equal(
			document.appendingItem('"--verbose"', path),
			replacing(source, '"health"]', '"health", "--verbose"]')
		);
		assert.deepEqual(doc(document.removingItem(path, 1)).items(path), ['"CMD"', '"health"']);
	});

	it('flow sequence comments, delimiters and CRLF are preserved', () => {
		const source = 'test: ["CMD", # mode\r\n  \'health\', # command\r\n] # end\r\nx-keep: café\r\n';
		const path = ['test'];
		const document = doc(source);
		assert.equal(document.removingItem(path, 0), replacing(source, '"CMD",', ''));
		const appended = document.appendingItem("'status'", path);
		assert.equal(appended, replacing(source, '] # end', " 'status'] # end"));
		assert.deepEqual(doc(appended).items(path), ['"CMD"', "'health'", "'status'"]);
		const empty = doc("test: [ 'health', ] # keep\n").removingItem(path, 0);
		assert.equal(empty, 'test: [  ] # keep\n');
		assert.equal(doc(empty).appendingItem("'status'", path), "test: [  'status'] # keep\n");
	});

	it('unsafe flow sequences fail closed', () => {
		for (const value of [
			'[&command CMD, health]',
			'[!custom CMD, health]',
			'[*command]',
			'[{command: health}]',
			'[[CMD, health]]',
			'[command: health]'
		]) {
			const document = doc('test: ' + value + '\n');
			assert.ok(!document.isEditable(['test']), value);
			assert.throws(() => document.settingItem("'status'", ['test'], 0), undefined, value);
			assert.throws(() => document.removingItem(['test'], 0), undefined, value);
			assert.throws(() => document.appendingItem("'status'", ['test']), undefined, value);
		}
		const document = doc('test: [CMD, health]\n');
		for (const value of [
			'one, two',
			'*command',
			'&command CMD',
			'!custom CMD',
			'{command: health}'
		]) {
			assert.throws(() => document.appendingItem(value, ['test']), undefined, value);
		}
	});

	for (const value of ['{}', '']) {
		it(`adds network address to empty attachment: ${JSON.stringify(value)}`, () => {
			const source =
				'services:\r\n  arcane:\r\n    networks:\r\n      vlan25: ' +
				value +
				' # keep attachment\r\n    image: arcane\r\nx-keep: true\r\n';
			const path = ['services', 'arcane', 'networks', 'vlan25', 'ipv4_address'];
			const document = doc(source);
			assert.ok(document.isEditable(path));
			const changed = document.setting("'192.0.2.25'", path);
			assert.equal(doc(changed).scalar(path), '192.0.2.25');
			assert.equal(
				changed,
				replacing(
					source,
					'vlan25: ' + value + ' # keep attachment\r\n',
					'vlan25:  # keep attachment\r\n        "ipv4_address": \'192.0.2.25\'\r\n'
				)
			);
		});
	}

	for (const value of ['{aliases: [arcane]}', 'arcane', '[]', '&network {}', '!custom {}']) {
		it(`refuses address under unsupported attachment: ${value}`, () => {
			const source = 'services:\n  arcane:\n    networks:\n      vlan25: ' + value + '\n';
			const path = ['services', 'arcane', 'networks', 'vlan25', 'ipv4_address'];
			const document = doc(source);
			assert.ok(!document.isEditable(path));
			assert.throws(() => document.setting("'192.0.2.25'", path));
		});
	}
});

/** Mirrors the shapes in the reported Arcane service with synthetic deployment values. */
export const screenshotFixture = [
	'services:',
	'  arcane:',
	'    image: "getarcaneapp/manager:next"',
	'    # image: example.test/arcane:next',
	'    pull_policy: always',
	'    container_name: arcane',
	'    domainname: svc.example.test',
	'    hostname: arcane.svc.example.test',
	'    volumes:',
	'      - "/var/run/docker.sock:/var/run/docker.sock"',
	'      - "arcane-data:/app/data"',
	'      - "arcane-backups:/backups"',
	'      - "/opt/arcane:/opt/arcane"',
	'    restart: unless-stopped',
	'    env_file: .env',
	'    networks:',
	'      vlan25:',
	'        ipv4_address: 192.0.2.40',
	'    healthcheck:',
	'      test: ["CMD", "/app/arcane", "health"]',
	'      interval: 30s',
	'      timeout: 5s',
	'      retries: 3',
	'    extra_hosts:',
	'      - "id.example.test:192.0.2.43"',
	'    dns:',
	'      - 192.0.2.5',
	'      - 192.0.2.53',
	'    dns_opt:',
	'      - trust-ad',
	'      - edns0',
	'    dns_search:',
	'      - example.test',
	'      - lxc.example.test',
	'      - svc.example.test',
	'    labels:',
	'      - "traefik.enable=true"',
	'      - "traefik.docker.allownonrunning=true"',
	'volumes:',
	'  arcane-data:',
	'    external: true',
	'  arcane-backups:',
	'    external: true',
	'networks:',
	'  vlan25:',
	'    external: true'
].join('\n');

describe('Arcane service configuration', () => {
	it('all screenshot scalar fields are editable', () => {
		const document = doc(screenshotFixture);
		for (const key of [
			'image',
			'pull_policy',
			'container_name',
			'domainname',
			'hostname',
			'restart',
			'env_file'
		]) {
			assert.notEqual(document.scalar(['services', 'arcane', key]), undefined, key);
			assert.ok(document.isEditable(['services', 'arcane', key]), key);
		}
	});

	it('static address edit preserves healthcheck and comments', () => {
		const edited = doc(screenshotFixture).setting(ComposeDocument.quoted('192.0.2.41'), [
			'services',
			'arcane',
			'networks',
			'vlan25',
			'ipv4_address'
		]);
		assert.equal(
			edited,
			replacing(screenshotFixture, 'ipv4_address: 192.0.2.40', 'ipv4_address: "192.0.2.41"')
		);
	});

	it('health command edit preserves inline array and rest of file', () => {
		const path = ['services', 'arcane', 'healthcheck', 'test'];
		const document = doc(screenshotFixture);
		assert.equal(document.items(path)?.length, 3);
		assert.ok(document.isEditable(['services', 'arcane', 'healthcheck']));
		const edited = document.settingItem(ComposeDocument.quoted('status'), path, 2);
		assert.equal(edited, replacing(screenshotFixture, '"health"]', '"status"]'));
	});

	it('duration edit preserves command and integer retries', () => {
		const edited = doc(screenshotFixture).setting(ComposeDocument.quoted('45s'), [
			'services',
			'arcane',
			'healthcheck',
			'interval'
		]);
		assert.equal(edited, replacing(screenshotFixture, 'interval: 30s', 'interval: "45s"'));
		assert.equal(doc(edited).rawValue(['services', 'arcane', 'healthcheck', 'retries']), '3');
	});

	it('native lists are available without normalizing source', () => {
		const document = doc(screenshotFixture);
		for (const key of ['volumes', 'extra_hosts', 'dns', 'dns_opt', 'dns_search', 'labels']) {
			assert.ok((document.items(['services', 'arcane', key])?.length ?? 0) > 0, key);
			assert.ok(document.isEditable(['services', 'arcane', key]), key);
		}
		assert.equal(document.source, screenshotFixture);
	});

	it('minimal service shows only existing configuration', () => {
		assert.deepEqual(
			doc('services:\n  web:\n    image: nginx:alpine\n')
				.nativeFields([{ key: 'services' }, { key: 'web' }])
				.map((field) => field.name),
			['image']
		);
		assert.deepEqual(
			doc('services:\n  web:\n    ports: []\n    environment:\n')
				.nativeFields([{ key: 'services' }, { key: 'web' }])
				.map((field) => field.name),
			['ports', 'environment']
		);
	});
});
