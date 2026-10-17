// Port of ComposeSchemaTests.swift and ComposeArcaneMetadataTests.swift.
import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { ComposeDocument } from '../model/compose-document';
import { ComposeFieldOptions } from '../model/compose-field-options';
import { editableNativeKinds, type ComposeFieldPathComponent } from '../model/compose-native-field';
import { ComposeSchema, preferredKind } from '../model/compose-schema';
import { addingDraft, makeSettingDraft } from '../model/compose-setting-draft';

const k = (name: string): ComposeFieldPathComponent => ({ key: name });
const i = (value: number): ComposeFieldPathComponent => ({ index: value });
const set = <T extends string>(values: Iterable<T>) =>
	[...new Set(values)].sort((a, b) => a.localeCompare(b));
const required = <T>(value: T | undefined): T => {
	assert.ok(value !== undefined);
	return value;
};

describe('Compose schema field suggestions', () => {
	const service = [k('services'), k('app')];

	it('service includes inherited and new specification fields', () => {
		const fields = ComposeSchema.fields(service);
		const names = new Set(fields.map((field) => field.name));
		for (const expected of [
			'image',
			'build',
			'deploy',
			'ports',
			'networks',
			'healthcheck',
			'env_file',
			'models',
			'post_start',
			'pre_stop'
		]) {
			assert.ok(names.has(expected), `Missing service field: ${expected}`);
		}
		assert.ok(fields.every((field) => field.kinds.length > 0));
		assert.equal(names.size, fields.length);
		const retries = required(ComposeSchema.value([...service, k('healthcheck'), k('retries')]));
		assert.deepEqual(set(retries.kinds), set(['number', 'string']));
		assert.equal(preferredKind(retries), 'number');
		assert.ok(retries.description !== '');
	});

	it('union paths resolve list items and mapping entries', () => {
		const envFile = [...service, k('env_file')];
		assert.deepEqual(
			set(required(ComposeSchema.value(envFile)).kinds),
			set(['string', 'sequence'])
		);
		assert.deepEqual(
			set(required(ComposeSchema.value([...envFile, i(0)])).kinds),
			set(['string', 'mapping'])
		);
		assert.deepEqual(
			set(ComposeSchema.fields([...envFile, i(0)]).map((field) => field.name)),
			set(['path', 'format', 'required'])
		);
		const ports = [...service, k('ports'), i(0)];
		assert.deepEqual(
			set(required(ComposeSchema.value(ports)).kinds),
			set(['number', 'string', 'mapping'])
		);
		assert.ok(ComposeSchema.fields(ports).some((field) => field.name === 'target'));
		const mounts = [...service, k('volumes'), i(0)];
		assert.ok(ComposeSchema.fields(mounts).some((field) => field.name === 'bind'));
		assert.ok(
			ComposeSchema.fields([...mounts, k('bind')]).some(
				(field) => field.name === 'create_host_path'
			)
		);
		assert.ok(
			ComposeSchema.fields([...service, k('networks'), k('frontend')]).some(
				(field) => field.name === 'ipv4_address'
			)
		);
		assert.deepEqual(ComposeSchema.value([...service, k('healthcheck'), k('test'), i(2)])?.kinds, [
			'string'
		]);
	});

	it('root resources and dictionary values resolve', () => {
		for (const resource of ['networks', 'volumes', 'secrets', 'configs', 'models', 'jobs']) {
			assert.ok(
				ComposeSchema.fields([k(resource), k('example')]).length > 0,
				`Missing resource schema: ${resource}`
			);
		}
		assert.ok(
			ComposeSchema.fields([k('models'), k('example')]).some(
				(field) => field.name === 'runtime_flags'
			)
		);
		assert.ok(
			ComposeSchema.fields([k('configs'), k('example')]).some((field) => field.name === 'content')
		);
		assert.notEqual(
			ComposeSchema.value([...service, k('labels'), k('example.test.label')]),
			undefined
		);
		assert.deepEqual(ComposeSchema.value([...service, k('x-example')])?.kinds, editableNativeKinds);
		assert.equal(ComposeSchema.value([...service, k('not_a_compose_field')]), undefined);
		assert.equal(ComposeSchema.value([...service, k('ports'), i(-1)]), undefined);
	});

	it('official properties are reachable through references and combinators', () => {
		type Node = Record<string, unknown>;
		const root = ComposeSchema.rootSnapshot() as Node;
		let checked = 0;
		const expand = (node: Node, seen: Set<string>): Node[] => {
			const result = [node];
			const ref = node.$ref;
			if (typeof ref === 'string' && !seen.has(ref)) {
				let target: unknown = root;
				for (const part of ref.slice(2).split('/'))
					target = (target as Node | undefined)?.[part] ?? {};
				if (target && typeof target === 'object')
					result.push(...expand(target as Node, new Set([...seen, ref])));
			}
			for (const key of ['allOf', 'oneOf', 'anyOf']) {
				for (const branch of (node[key] as Node[] | undefined) ?? [])
					result.push(...expand(branch, seen));
			}
			return result;
		};
		const visit = (node: Node, path: ComposeFieldPathComponent[], depth: number) => {
			if (depth >= 12) return;
			const suggested = new Set(ComposeSchema.fields(path).map((field) => field.name));
			for (const variant of expand(node, new Set())) {
				for (const [name, child] of Object.entries(
					(variant.properties as Record<string, Node> | undefined) ?? {}
				)) {
					checked += 1;
					assert.ok(
						suggested.has(name),
						`Missing schema property: ${JSON.stringify(path)} / ${name}`
					);
					const field = ComposeSchema.value([...path, k(name)]);
					assert.notEqual(field, undefined);
					if (field && field.enumValues.length > 0) {
						const options = new ComposeFieldOptions([...path, k(name)]);
						assert.deepEqual(options.values, field.enumValues);
						assert.ok(!options.allowsCustom);
					}
					visit(child, [...path, k(name)], depth + 1);
				}
				for (const [pattern, child] of Object.entries(
					(variant.patternProperties as Record<string, Node> | undefined) ?? {}
				)) {
					const sample = pattern.startsWith('^x-') ? 'x-example' : 'example';
					if (new RegExp(pattern).test(sample)) visit(child, [...path, k(sample)], depth + 1);
				}
				const item = variant.items;
				if (item && typeof item === 'object' && !Array.isArray(item))
					visit(item as Node, [...path, i(0)], depth + 1);
				const additional = variant.additionalProperties;
				if (additional && typeof additional === 'object')
					visit(additional as Node, [...path, k('example')], depth + 1);
			}
		};
		visit(root, [], 0);
		assert.ok(checked > 300);
	});

	it('guided inputs use schema and scoped policy choices', () => {
		assert.equal(
			preferredKind(required(ComposeSchema.value([...service, k('privileged')]))),
			'boolean'
		);
		const mount = makeSettingDraft('Item', [...service, k('volumes'), i(0)]);
		assert.equal(mount.kind, 'mapping');
		assert.ok(new ComposeFieldOptions([...mount.schemaPath, k('type')]).values.includes('bind'));
		assert.ok(!new ComposeFieldOptions([...mount.schemaPath, k('type')]).allowsCustom);
		const restart = new ComposeFieldOptions([...service, k('restart')]);
		assert.deepEqual(restart.values, ['no', 'always', 'on-failure', 'unless-stopped']);
		assert.ok(restart.allowsCustom);
		assert.deepEqual(
			new ComposeFieldOptions([...service, k('ports'), i(0), k('protocol')]).values,
			['tcp', 'udp']
		);
		assert.deepEqual(
			new ComposeFieldOptions([...service, k('deploy'), k('restart_policy'), k('condition')])
				.values,
			['none', 'on-failure', 'any']
		);
		assert.deepEqual(new ComposeFieldOptions([...service, k('labels'), k('restart')]).values, []);
		const gpu = {
			...makeSettingDraft('gpus', [...service, k('gpus')], true),
			kind: 'sequence' as const
		};
		// An enum on the alternative string branch must not reject a list.
		addingDraft(gpu, 'services: {app: {image: alpine}}\n', service);
	});

	it('fixed choice catalog covers nested fields and leaves text open', () => {
		const cases: [ComposeFieldPathComponent[], string][] = [
			[[k('deploy'), k('update_config'), k('failure_action')], 'rollback'],
			[[k('deploy'), k('rollback_config'), k('failure_action')], 'pause'],
			[[k('volumes'), i(0), k('bind'), k('propagation')], 'rprivate'],
			[[k('volumes'), i(0), k('consistency')], 'cached'],
			[[k('isolation')], 'hyperv'],
			[[k('build'), k('isolation')], 'process'],
			[[k('cap_add'), i(0)], 'NET_ADMIN'],
			[[k('cap_drop'), i(0)], 'ALL'],
			[[k('devices'), i(0), k('permissions')], 'rw'],
			[[k('env_file'), i(0), k('format')], 'raw']
		];
		for (const [suffix, value] of cases) {
			const options = new ComposeFieldOptions([...service, ...suffix]);
			assert.ok(options.values.includes(value), value);
			assert.ok(!options.allowsCustom, value);
		}
		assert.deepEqual(
			new ComposeFieldOptions([...service, k('healthcheck'), k('test'), i(0)]).values,
			['CMD', 'CMD-SHELL', 'NONE']
		);
		assert.deepEqual(
			new ComposeFieldOptions([...service, k('healthcheck'), k('test'), i(1)]).values,
			[]
		);
		assert.ok(new ComposeFieldOptions([...service, k('stop_signal')]).values.includes('SIGTERM'));
		assert.ok(
			new ComposeFieldOptions([k('jobs'), k('backup'), k('deploy'), k('mode')]).values.includes(
				'replicated-job'
			)
		);
		for (const name of ['image', 'container_name', 'command']) {
			assert.deepEqual(new ComposeFieldOptions([...service, k(name)]).values, []);
		}
		assert.deepEqual(new ComposeFieldOptions([...service, k('labels'), k('isolation')]).values, []);
	});
});

describe('Arcane Compose metadata', () => {
	const metadata = [k('x-arcane')];
	const serviceMetadata = [k('services'), k('web'), k('x-arcane')];

	it('root and service metadata offer their supported fields', () => {
		assert.ok(
			ComposeSchema.fields([]).some(
				(field) => field.name === 'x-arcane' && field.kinds.join() === 'mapping'
			)
		);
		assert.ok(
			ComposeSchema.fields([k('services'), k('web')]).some(
				(field) => field.name === 'x-arcane' && field.kinds.join() === 'mapping'
			)
		);
		assert.deepEqual(
			set(ComposeSchema.fields(metadata).map((field) => field.name)),
			set(['icon', 'icons', 'icon-light', 'icon-dark', 'hidden', 'urls', 'tags', 'updater'])
		);
		assert.deepEqual(
			set(ComposeSchema.fields(serviceMetadata).map((field) => field.name)),
			set(['icon', 'icons', 'icon-light', 'icon-dark', 'hidden', 'updater'])
		);
		for (const path of [metadata, serviceMetadata]) {
			assert.deepEqual(required(ComposeSchema.value([...path, k('hidden')])).kinds, ['boolean']);
			assert.deepEqual(
				set(required(ComposeSchema.value([...path, k('icons')])).kinds),
				set(['string', 'sequence'])
			);
			assert.deepEqual(required(ComposeSchema.value([...path, k('icons'), i(0)])).kinds, [
				'string'
			]);
		}
	});

	it('updater and tag items have typed fields and enums', () => {
		for (const path of [metadata, serviceMetadata]) {
			const updater = [...path, k('updater')];
			assert.deepEqual(
				set(ComposeSchema.fields(updater).map((field) => field.name)),
				set(['enabled', 'strategy', 'constraint', 'tag-pattern'])
			);
			assert.deepEqual(required(ComposeSchema.value([...updater, k('enabled')])).kinds, [
				'boolean'
			]);
			const strategy = required(ComposeSchema.value([...updater, k('strategy')]));
			assert.deepEqual(strategy.kinds, ['string']);
			assert.deepEqual(set(strategy.enumValues), set(['auto', 'tag', 'digest']));
			for (const name of ['constraint', 'tag-pattern'])
				assert.deepEqual(required(ComposeSchema.value([...updater, k(name)])).kinds, ['string']);
		}
		const tag = [...metadata, k('tags'), i(0)];
		assert.deepEqual(required(ComposeSchema.value(tag)).kinds, ['mapping']);
		assert.deepEqual(
			set(ComposeSchema.fields(tag).map((field) => field.name)),
			set(['name', 'color'])
		);
		assert.deepEqual(required(ComposeSchema.value([...tag, k('name')])).kinds, ['string']);
		const color = required(ComposeSchema.value([...tag, k('color')]));
		assert.deepEqual(color.kinds, ['string']);
		assert.deepEqual(
			set(color.enumValues),
			set(['gray', 'purple', 'blue', 'green', 'yellow', 'orange', 'red', 'pink'])
		);
	});

	it('native metadata creation preserves existing compose source and no-op edits', () => {
		const source =
			'# project metadata\nservices:\n  web:\n    image: nginx:latest # keep image\nx-extra: ${KEEP}\n';
		let edited = ComposeDocument.parse(source).addingNative('', 'mapping', 'x-arcane', []);
		edited = ComposeDocument.parse(edited).addingNative('', 'mapping', 'updater', metadata);
		const updater = [...metadata, k('updater')];
		edited = ComposeDocument.parse(edited).addingNative('true', 'boolean', 'enabled', updater);
		edited = ComposeDocument.parse(edited).addingNative('digest', 'string', 'strategy', updater);
		edited = ComposeDocument.parse(edited).addingNative('', 'sequence', 'tags', metadata);
		const tags = [...metadata, k('tags')];
		edited = ComposeDocument.parse(edited).addingNative('', 'mapping', undefined, tags);
		const tag = [...tags, i(0)];
		edited = ComposeDocument.parse(edited).addingNative('Production', 'string', 'name', tag);
		edited = ComposeDocument.parse(edited).addingNative('green', 'string', 'color', tag);
		assert.ok(edited.includes(source));
		const document = ComposeDocument.parse(edited);
		assert.equal(document.nativeField([...updater, k('enabled')]).kind, 'boolean');
		assert.equal(document.nativeField([...tag, k('name')]).value, 'Production');
		for (const path of [
			[...updater, k('enabled')],
			[...updater, k('strategy')],
			[...tag, k('name')],
			[...tag, k('color')]
		]) {
			const field = document.nativeField(path);
			assert.equal(document.settingNative(field.value, field.kind, path), edited);
		}
	});
});
