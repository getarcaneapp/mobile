import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { ComposeDocument } from '../model/compose-document';
import type { ComposeFieldPathComponent } from '../model/compose-native-field';

const doc = (source: string) => ComposeDocument.parse(source);
const k = (name: string): ComposeFieldPathComponent => ({ key: name });
const i = (value: number): ComposeFieldPathComponent => ({ index: value });
const replacing = (source: string, of: string, withText: string) => source.split(of).join(withText);

describe('Compose block scalars', () => {
	it('literal and folded values follow indentation and chomping', () => {
		const fixtures: [string, string][] = [
			['value: |\n  first\n  second\nnext: keep\n', 'first\nsecond\n'],
			['value: |-\n  first\n  second\n\nnext: keep\n', 'first\nsecond'],
			['value: |+\n  first\n\nnext: keep\n', 'first\n\n'],
			['value: |\n  first', 'first'],
			['value: |\n\nnext: keep\n', ''],
			['value: |+\n\nnext: keep\n', '\n'],
			['value: |\n  \n   \nnext: keep\n', ''],
			['value: |+\n  \n   \nnext: keep\n', '\n\n'],
			['value: |2-\n    indented\n  plain\n', '  indented\nplain'],
			['value: >-\n  first\n  second\n', 'first second'],
			['value: >\n  first\n\n  second\n', 'first\nsecond\n'],
			['value: >+\n  first\n\n\n  second\n\n', 'first\n\nsecond\n\n'],
			['value: >-\n  first\n    indented\n  last\n', 'first\n  indented\nlast'],
			['value: >-\n  first\n\n    indented\n\n  last\n', 'first\n\n  indented\n\nlast'],
			['value: >\n\n  first\n  second\n', '\nfirst second\n'],
			[
				'value: | # retained\r\n  café 🐳\r\n  ${VALUE}\r\n\r\nnext: keep\r\n',
				'café 🐳\n${VALUE}\n'
			]
		];
		for (const [source, expected] of fixtures) {
			const document = doc(source);
			const field = document.nativeField([k('value')]);
			assert.equal(field.kind, 'string', source);
			assert.equal(field.value, expected, source);
			assert.equal(
				document.settingNative(expected, 'string', field.path),
				source,
				`Unchanged block must preserve all bytes: ${source}`
			);
		}
	});

	it('edited blocks preserve requested value and surrounding source', () => {
		const originals = [
			'value: | # script\n  old\nnext: untouched # tail\n',
			'value: >- # script\n  old\n  wrapped\n\nnext: untouched # tail\n',
			'value: |2+ # script\r\n  old\r\n\r\nnext: untouched # tail\r\n'
		];
		const values = [
			'',
			'single',
			'first\nsecond',
			'first\nsecond\n',
			'first\n\n',
			'\n',
			'\n\n',
			'  leading\n  spaces\n',
			'\n  spaces\n',
			'${KEEP}\n# content\n',
			'\tleading\n',
			'foo\rbar'
		];
		for (const source of originals) {
			for (const value of values) {
				const changed = doc(source).settingNative(value, 'string', [k('value')]);
				const reparsed = doc(changed);
				assert.equal(reparsed.nativeField([k('value')]).value, value, changed);
				assert.ok(changed.includes('# script'));
				assert.ok(
					changed.endsWith(
						source.includes('\r\n') ? 'next: untouched # tail\r\n' : 'next: untouched # tail\n'
					),
					changed
				);
				assert.equal(reparsed.settingNative(value, 'string', [k('value')]), changed);
			}
		}
	});

	it('command and config fixtures remain source backed', () => {
		const source = [
			'name: operator',
			'services:',
			'  web:',
			'    image: nginx:${TAG:-latest}',
			'    command: >-',
			'      sh -c',
			"      'echo ${MESSAGE};",
			"      sleep 5'",
			"    healthcheck: {test: [CMD, curl, '-f', 'http://localhost'], retries: 3}",
			'    configs: [{source: app, target: /etc/app.conf}]',
			'configs:',
			'  app:',
			'    content: | # application settings',
			'      [server]',
			'      token=${TOKEN}',
			'      # this belongs to the config',
			'x-extension: {preserve: true}',
			''
		].join('\n');
		const command = [k('services'), k('web'), k('command')];
		const config = [k('configs'), k('app'), k('content')];
		const document = doc(source);
		assert.equal(document.nativeField(command).value, "sh -c 'echo ${MESSAGE}; sleep 5'");
		assert.equal(
			document.nativeField(config).value,
			'[server]\ntoken=${TOKEN}\n# this belongs to the config\n'
		);
		const changed = document.settingNative('[server]\ntoken=${NEW_TOKEN}\n', 'string', config);
		assert.ok(changed.startsWith(source.slice(0, source.indexOf('    content:'))));
		assert.equal(doc(changed).nativeField(command).value, document.nativeField(command).value);
		assert.ok(changed.endsWith('x-extension: {preserve: true}\n'));
	});

	it('sequence block and anchor definitions edit without expanding references', () => {
		const source =
			'x-shared: &shared\n  image: nginx\n  restart: always\nx-command: &command |-\n  echo old\nservices:\n  web:\n    <<: *shared\n    command: *command\n    entrypoint:\n      - sh\n      - -c\n      - |2-\n          echo nested\n';
		const command = [k('x-command')];
		const document = doc(source);
		assert.equal(document.nativeField(command).value, 'echo old');
		const anchored = document.settingNative('echo new', 'string', command);
		assert.ok(anchored.includes('x-command: &command |-\n  echo new\n'));
		assert.ok(anchored.includes('command: *command'));
		const mapping = doc(anchored).settingNative('alpine', 'string', [k('x-shared'), k('image')]);
		assert.ok(mapping.includes('x-shared: &shared\n  image: "alpine"\n'));
		assert.ok(mapping.includes('<<: *shared'));
		assert.throws(() => doc(mapping).removingNative([k('x-shared')]));
		assert.throws(() => doc(mapping).settingNative('12', 'number', command));
		const sequence = doc('items:\n  - |2-\n     indented\n  - keep\n');
		assert.equal(sequence.nativeField([k('items'), i(0)]).value, ' indented');
		const edited = sequence.settingNative('new\nline', 'string', [k('items'), i(0)]);
		assert.equal(doc(edited).nativeField([k('items'), i(0)]).value, 'new\nline');
		assert.ok(edited.endsWith('  - keep\n'));
	});

	it('scalar anchor name and aliases survive target edits', () => {
		const source = 'image: &image nginx # shared\nother: *image\n';
		const document = doc(source);
		assert.equal(document.nativeField([k('image')]).kind, 'string');
		assert.equal(
			document.settingNative('alpine', 'string', [k('image')]),
			'image: &image "alpine" # shared\nother: *image\n'
		);
		assert.equal(document.nativeField([k('other')]).kind, 'unsupported');
		assert.throws(() => document.settingNative('changed', 'string', [k('other')]));
		assert.throws(() => document.removingNative([k('image')]));
	});

	it('merged services expose only explicit fields without expanding aliases', () => {
		const source =
			'x-base: &base\n  restart: always\nservices:\n  web:\n    <<: *base\n    image: nginx\n    command: |-\n      echo original\n';
		const service = [k('services'), k('web')];
		const document = doc(source);
		assert.deepEqual(
			document.nativeFields(service).map((field) => field.name),
			['<<', 'image', 'command']
		);
		assert.equal(document.nativeField([...service, k('<<')]).kind, 'unsupported');
		const edited = document.settingNative('echo edited', 'string', [...service, k('command')]);
		assert.ok(edited.includes('    <<: *base\n    image: nginx\n'));
		const override = doc(edited).addingNative('unless-stopped', 'string', 'restart', service);
		assert.ok(override.startsWith('x-base: &base\n  restart: always\n'));
		assert.ok(override.includes('    <<: *base\n'));
		assert.throws(() => document.removingNative([...service, k('<<')]));
		assert.throws(() => document.settingNative('', 'mapping', [...service, k('<<')]));
	});

	it('implicit null fields and items have byte identical no-ops', () => {
		const source =
			'environment:\n  PASSTHROUGH: # host variable\nitems:\n  - # empty\n  - explicit\n';
		const document = doc(source);
		for (const path of [
			[k('environment'), k('PASSTHROUGH')],
			[k('items'), i(0)]
		]) {
			assert.equal(document.nativeField(path).kind, 'null');
			assert.equal(document.settingNative('', 'null', path), source);
		}
	});

	it('compose override and reset tags keep their spelling and meaning', () => {
		const source =
			'services:\n  web:\n    ports: !override ["8080:80", "8443:443"] # replacements\n    environment:\n      TOKEN: !reset null # cleared\n';
		const ports = [k('services'), k('web'), k('ports')];
		const reset = [k('services'), k('web'), k('environment'), k('TOKEN')];
		const document = doc(source);
		assert.equal(document.nativeField(ports).kind, 'sequence');
		assert.equal(document.settingNative('', 'null', reset), source);
		const changed = document.settingNative('9090:80', 'string', [...ports, i(0)]);
		assert.equal(changed, replacing(source, '8080:80', '9090:80'));
		const added = doc(changed).addingNative('9000:9000', 'string', undefined, ports);
		assert.ok(added.includes('ports: !override ['));
		assert.ok(added.includes('TOKEN: !reset null # cleared'));
		assert.equal(doc(added).nativeFields(ports).length, 3);
		assert.equal(
			doc('items: [!custom value]\n').nativeField([k('items'), i(0)]).kind,
			'unsupported'
		);
	});
});

describe('Compose native fields', () => {
	it('creates service with its first setting and preserves project fields', () => {
		for (const source of [
			'# keep\nnetworks:\n  shared: {}\n',
			'# keep\nservices: {existing: {image: alpine}}\nnetworks: {shared: {}}\n'
		]) {
			const result = doc(source).addingService('worker', 'image', 'busybox:latest', 'string');
			const document = doc(result);
			assert.ok(document.services.includes('worker'), result);
			assert.equal(
				document.nativeField([k('services'), k('worker'), k('image')]).value,
				'busybox:latest'
			);
			assert.equal(document.nativeField([k('networks'), k('shared')]).kind, 'mapping');
			assert.ok(result.includes('# keep'));
			if (source.includes('existing')) assert.ok(document.services.includes('existing'));
		}
	});

	it('rejects duplicate or invalid service without changing source', () => {
		const source = 'services:\n  web:\n    image: nginx\n';
		const document = doc(source);
		for (const name of ['web', '', 'bad name', 'bad\nname']) {
			assert.throws(
				() => document.addingService(name, 'image', 'alpine', 'string'),
				undefined,
				name
			);
		}
		assert.throws(() => document.addingService('worker', 'scale', 'not a number', 'number'));
		assert.equal(document.source, source);
	});

	it('nested block fields preserve unrelated source', () => {
		const source =
			'# header\r\nservices:\r\n  web:\r\n    healthcheck:\r\n      retries: 3 # attempts\r\n      test:\r\n        - CMD\r\n        - curl\r\nx-extra: ${KEEP}\r\n';
		const path = [k('services'), k('web'), k('healthcheck'), k('retries')];
		const changed = doc(source).settingNative('5', 'number', path);
		assert.equal(changed, replacing(source, 'retries: 3', 'retries: 5'));
		const item = [...path.slice(0, -1), k('test'), i(1)];
		const updated = doc(changed).settingNative('wget', 'string', item);
		assert.ok(updated.includes('- "wget"'));
		assert.ok(updated.includes('x-extra: ${KEEP}\r\n'));
	});

	it('nested flow fields are edited in place', () => {
		const source = "settings: {enabled: true, values: [1, {name: 'old', keep: yes}]} # keep\n";
		const path = [k('settings'), k('values'), i(1), k('name')];
		const changed = doc(source).settingNative('new', 'string', path);
		assert.equal(changed, replacing(source, "'old'", '"new"'));
		const added = doc(changed).addingNative('false', 'boolean', 'other', [k('settings')]);
		assert.equal(doc(added).nativeField([k('settings'), k('other')]).kind, 'boolean');
		const removed = doc(added).removingNative([k('settings'), k('enabled')]);
		assert.ok(removed.includes('# keep'));
		assert.ok(!removed.includes('enabled'));
	});

	it('null and missing objects can be filled', () => {
		for (const source of ['settings: null # keep\n', 'settings: # keep\n', '# keep\n']) {
			const updated = doc(source).addingNative('value', 'string', 'name', [k('settings')]);
			assert.equal(doc(updated).nativeField([k('settings'), k('name')]).value, 'value', updated);
			assert.ok(updated.includes('# keep'));
		}
	});

	it('native type changes do not confuse strings and booleans', () => {
		const source = "enabled: true\ncount: '12'\n";
		const text = doc(source).settingNative('true', 'string', [k('enabled')]);
		assert.ok(text.includes('enabled: "true"'));
		assert.equal(doc(text).nativeField([k('enabled')]).kind, 'string');
		const number = doc(text).settingNative('12', 'number', [k('count')]);
		assert.equal(doc(number).nativeField([k('count')]).kind, 'number');
		assert.throws(() => doc(number).settingNative('12 # comment', 'number', [k('count')]));
	});

	it('native multiline text remains editable', () => {
		const text = doc('value: initial\n').settingNative('first\nsecond', 'string', [k('value')]);
		const field = doc(text).nativeField([k('value')]);
		assert.equal(field.kind, 'string');
		assert.equal(field.value, 'first\nsecond');
		assert.equal(doc(text).settingNative(field.value, field.kind, field.path), text);
	});

	it('references and duplicate flow keys fail closed', () => {
		const document = doc('options:\n  shared: &shared {key: value}\nother: *shared\n');
		assert.throws(() => document.settingNative('', 'null', [k('options')]));
		assert.throws(() => document.removingNative([k('options')]));
		assert.throws(() => doc('options: {key: one, key: two}'));
	});

	it('short networks convert and accept static options', () => {
		for (const source of [
			'services:\n  web:\n    networks:\n      - front # first\n      - back\n',
			'services:\r\n  web:\r\n    networks: [front, # first\r\n      back] # networks\r\n'
		]) {
			const path = ['services', 'web', 'networks'];
			const converted = doc(source).convertingNetworkAttachments(path);
			const changed = doc(converted).setting("'172.20.0.2'", [...path, 'front', 'ipv4_address']);
			assert.equal(doc(changed).scalar([...path, 'front', 'ipv4_address']), '172.20.0.2');
			assert.ok(changed.includes('# first'));
		}
	});

	it('duplicate networks do not convert', () => {
		assert.throws(() =>
			doc('services:\n  web:\n    networks: [front, front]\n').convertingNetworkAttachments([
				'services',
				'web',
				'networks'
			])
		);
	});

	it('empty networks convert to an editable mapping', () => {
		const path = ['services', 'web', 'networks'];
		const converted = doc(
			'services:\n  web:\n    networks: [] # keep\n'
		).convertingNetworkAttachments(path);
		const added = doc(converted).setting('{}', [...path, 'front']);
		assert.deepEqual(doc(added).keys(path), ['front']);
		assert.ok(added.includes('# keep'));
	});

	it('flow services appear in native navigation', () => {
		assert.deepEqual(doc('services: {web: {image: nginx}, db: {image: postgres}}\n').services, [
			'web',
			'db'
		]);
	});

	it('compact sequence mapping removal retains the outer item', () => {
		const source =
			'ports:\n  - target: 80 # remove target\n    published: 8080\n    protocol: tcp\n  - target: 443\n';
		const edited = doc(source).removingNative([k('ports'), i(0), k('target')]);
		const document = doc(edited);
		assert.equal(document.nativeFields([k('ports')]).length, 2);
		assert.equal(document.nativeField([k('ports'), i(0), k('published')]).value, '8080');
		assert.equal(document.nativeField([k('ports'), i(1), k('target')]).value, '443');
		assert.ok(edited.includes('# remove target'));
	});

	it('implicit flow null keys are editable and deduplicated', () => {
		const source = 'environment: {TOKEN, OTHER: explicit} # keep\n';
		const document = doc(source);
		const token = [k('environment'), k('TOKEN')];
		assert.deepEqual(
			document.nativeFields([k('environment')]).map((field) => field.name),
			['TOKEN', 'OTHER']
		);
		assert.equal(document.settingNative('', 'null', token), source);
		assert.equal(
			document.settingNative('secret', 'string', token),
			'environment: {TOKEN: "secret", OTHER: explicit} # keep\n'
		);
		assert.throws(() => doc('environment: {TOKEN, TOKEN: duplicate}\n'));
	});
});
