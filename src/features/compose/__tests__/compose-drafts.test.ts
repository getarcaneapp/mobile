// Port of ComposeEntryDraftTests, ComposeEntryNativeTransitionTests, the draft half of
// ComposeNativeFieldsTests, EnvDocumentTests, ProjectDraftSnapshotTests and ComposePreviewSessionTests.
import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { ComposeDocument } from '../model/compose-document';
import { ComposeEntryDraft, type ComposeEntryKind } from '../model/compose-entry-draft';
import type { ComposeFieldPathComponent } from '../model/compose-native-field';
import {
	composePreviewPreferenceKey,
	makeComposePreviewSession
} from '../model/compose-preview-session';
import {
	addingDraft,
	appendEntry,
	makeSettingDraft,
	prepareFields,
	type ComposeSettingDraft
} from '../model/compose-setting-draft';
import { EnvDocument } from '../model/env-document';
import {
	ProjectDraftReview,
	snapshotsEqual,
	type ProjectDraftSnapshot
} from '../model/project-draft-snapshot';

const k = (name: string): ComposeFieldPathComponent => ({ key: name });
const i = (value: number): ComposeFieldPathComponent => ({ index: value });
const doc = (source: string) => ComposeDocument.parse(source);
const wrap = (raw: string) =>
	'entry:\n' +
	raw
		.split('\n')
		.map((line) => '  ' + line)
		.join('\n');
const withChild = (
	draft: ComposeSettingDraft,
	index: number,
	changes: Partial<ComposeSettingDraft>
): ComposeSettingDraft => ({
	...draft,
	children: draft.children.map((child, position) =>
		position === index ? { ...child, ...changes } : child
	)
});

describe('ComposeEntryDraft', () => {
	for (const raw of ["'80:80'", "'127.0.0.1:8080:80/udp'", "'8000-8010:9000-9010'"]) {
		it(`untouched ports preserve spelling ${raw}`, () =>
			assert.equal(new ComposeEntryDraft(raw, 'port').yaml('port'), raw));
	}
	for (const raw of ["'data:/data:rw'", "'/tmp:/data:ro'", "'/data'"]) {
		it(`untouched mounts preserve spelling ${raw}`, () =>
			assert.equal(new ComposeEntryDraft(raw, 'mount').yaml('mount'), raw));
	}
	it('passthrough variable remains unset', () =>
		assert.equal(new ComposeEntryDraft("'TOKEN'", 'keyValue').yaml('keyValue'), "'TOKEN'"));
	it('edited key value preserves equals', () => {
		const draft = new ComposeEntryDraft("'TOKEN=a=b'", 'keyValue');
		assert.equal(draft.target, 'a=b');
		assert.equal(draft.with({ target: 'c=d' }).yaml('keyValue'), '"TOKEN=c=d"');
	});
	it('long port preserves unknown fields and comments', () => {
		const raw = "target: 80 # container\npublished: '8080'\nmode: host\nname: public";
		const draft = new ComposeEntryDraft(raw, 'port');
		assert.equal(draft.yaml('port'), raw);
		const changed = draft.with({ source: '8081' }).yaml('port');
		assert.ok(changed.includes('target: 80 # container'));
		assert.ok(changed.includes('mode: host\nname: public'));
		assert.ok(!changed.includes('protocol'));
		assert.equal(doc(changed).scalar(['published']), '8081');
	});
	it('read only capitalization is understood', () => {
		const raw = 'type: bind\nsource: /tmp\ntarget: /data\nread_only: True';
		const draft = new ComposeEntryDraft(raw, 'mount');
		assert.ok(draft.readOnly);
		assert.equal(draft.yaml('mount'), raw);
	});
	it('complex entries require YAML', () => {
		for (const raw of ["'${PORT}:80'", "'[::1]:80:80'"])
			assert.throws(() => new ComposeEntryDraft(raw, 'port'));
		assert.throws(() => new ComposeEntryDraft("'/tmp:/data:ro,z'", 'mount'));
	});
	it('rejects invalid new inputs', () => {
		const draft = new ComposeEntryDraft();
		assert.throws(() => draft.with({ target: '65536' }).yaml('port'));
		assert.throws(() => draft.with({ target: 'relative/path' }).yaml('mount'));
	});
	it('editing long mount source updates type', () => {
		const bind = new ComposeEntryDraft(
			'type: bind\nsource: /tmp\ntarget: /data\nread_only: true',
			'mount'
		);
		const volume = bind.with({ source: 'data' }).yaml('mount');
		assert.equal(doc(volume).scalar(['type']), 'volume');
		assert.ok(volume.includes('target: /data\nread_only: true'));
		const back = new ComposeEntryDraft(volume, 'mount').with({ source: './data' });
		assert.equal(doc(back.yaml('mount')).scalar(['type']), 'bind');
	});
	for (const options of [
		'bind:\n  propagation: rshared',
		'volume:\n  nocopy: true',
		'tmpfs:\n  size: 1024'
	]) {
		it(`changing mount type with special options requires YAML: ${options.split(':')[0]}`, () => {
			const draft = new ComposeEntryDraft(
				'type: bind\nsource: /tmp\ntarget: /data\n' + options,
				'mount'
			);
			assert.throws(() => draft.with({ source: 'data' }).yaml('mount'));
		});
	}
});

describe('ComposeEntry native transitions', () => {
	it('port edits survive native settings and further basic edits', () => {
		const original = "target: 80 # container\npublished: '8080'\nmode: ingress\nname: public";
		const firstEdit = new ComposeEntryDraft(original, 'port').with({ source: '8081' }).yaml('port');
		const nativeEdit = doc(wrap(firstEdit)).settingNative('host', 'string', [
			k('entry'),
			k('mode')
		]);
		const nativeRaw = doc(nativeEdit).rawValue(['entry']);
		assert.ok(nativeRaw !== undefined);
		const result = new ComposeEntryDraft(nativeRaw, 'port').with({ target: '81' }).yaml('port');
		const document = doc(result);
		assert.equal(document.scalar(['published']), '8081');
		assert.equal(document.scalar(['target']), '81');
		assert.equal(document.scalar(['mode']), 'host');
		assert.equal(document.scalar(['name']), 'public');
		assert.ok(result.includes('# container'));
	});
	it('mount edits survive native settings and further basic edits', () => {
		const original = 'type: bind\nsource: /srv/data\ntarget: /data\nbind:\n  propagation: rprivate';
		const firstEdit = new ComposeEntryDraft(original, 'mount')
			.with({ target: '/storage' })
			.yaml('mount');
		const nativeEdit = doc(wrap(firstEdit)).settingNative('rshared', 'string', [
			k('entry'),
			k('bind'),
			k('propagation')
		]);
		const nativeRaw = doc(nativeEdit).rawValue(['entry']);
		assert.ok(nativeRaw !== undefined);
		const document = doc(
			new ComposeEntryDraft(nativeRaw, 'mount').with({ readOnly: true }).yaml('mount')
		);
		assert.equal(document.scalar(['source']), '/srv/data');
		assert.equal(document.scalar(['target']), '/storage');
		assert.equal(document.scalar(['read_only']), 'true');
		assert.equal(document.scalar(['bind', 'propagation']), 'rshared');
	});
	for (const raw of [
		"target: 80 # container\npublished: '8080'\nmode: host",
		'type: bind\nsource: /srv/data\ntarget: /data\nbind:\n  propagation: rprivate'
	]) {
		it(`opening native settings without editing preserves entry (${raw.split(':')[0]})`, () => {
			const kind: ComposeEntryKind = raw.startsWith('target:') ? 'port' : 'mount';
			const basicRaw = new ComposeEntryDraft(raw, kind).yaml(kind);
			const extracted = doc(wrap(basicRaw)).rawValue(['entry']);
			assert.ok(extracted !== undefined);
			assert.equal(new ComposeEntryDraft(extracted, kind).yaml(kind), raw);
		});
	}
});

describe('ComposeSettingDraft', () => {
	it('saves configured dictionary and skips blank entries', () => {
		const parent = [k('services'), k('web')];
		let draft: ComposeSettingDraft = {
			...makeSettingDraft('annotations', [...parent, k('annotations')], true),
			kind: 'mapping'
		};
		draft = prepareFields(draft);
		draft = withChild(draft, 0, { name: 'owner', value: 'team' });
		draft = appendEntry(draft);
		const source = '# keep\nservices: {web: {image: nginx}}\n';
		const result = addingDraft(draft, source, parent);
		const document = doc(result);
		assert.equal(document.nativeField([...parent, k('annotations'), k('owner')]).value, 'team');
		assert.equal(document.nativeFields([...parent, k('annotations')]).length, 1);
		assert.ok(result.includes('# keep'));
		draft = withChild(draft, 1, { name: 'owner', value: 'duplicate' });
		assert.throws(() => addingDraft(draft, source, parent));
		assert.equal(doc(source).nativeFields(parent).length, 1);
	});

	it('creates service with configured list and default boolean', () => {
		let draft = prepareFields(
			makeSettingDraft('cap_add', [k('services'), k('web'), k('cap_add')], true)
		);
		draft = withChild(draft, 0, { value: 'NET_ADMIN' });
		const result = addingDraft(draft, '# keep\nservices: {}\n', [], 'web');
		const path = [k('services'), k('web')];
		assert.equal(doc(result).nativeField([...path, k('cap_add'), i(0)]).value, 'NET_ADMIN');
		const toggle = {
			...makeSettingDraft('privileged', [...path, k('privileged')], true),
			kind: 'boolean' as const
		};
		const updated = addingDraft(toggle, result, path);
		assert.equal(doc(updated).nativeField([...path, k('privileged')]).value, 'false');
	});
});

describe('EnvDocument', () => {
	it('preserves unicode, CRLF and comments', () => {
		const source = "# 🐳\r\nexport TOKEN='café'\r\nOTHER=${KEEP}\r\n";
		const document = new EnvDocument(source);
		const entry = document.entries[0];
		assert.ok(entry);
		assert.equal(document.setting('café', entry), source);
		assert.equal(document.setting('new', entry), source.replace("'café'", "'new'"));
	});
	it('unsupported lines and duplicates remain raw', () => {
		const document = new EnvDocument(
			'# comment\nA=one\nA=two\nB=plain # comment\nC="escape\\n"\nD=good\n'
		);
		assert.deepEqual(
			document.entries.map((entry) => entry.name),
			['D']
		);
		assert.equal(document.unsupportedLines, 4);
	});
	it('multiline content does not become editable entries', () => {
		assert.deepEqual(
			new EnvDocument("A='first\nB=inside\nlast'\nC=outside\n").entries.map((entry) => entry.name),
			['C']
		);
	});
	it('adding and removing preserves neighbors', () => {
		const source = '# header\r\nA=1\r\nB=2\r\n';
		const document = new EnvDocument(source);
		assert.equal(document.adding('C'), source + 'C=\r\n');
		assert.throws(() => document.adding('A'));
		assert.throws(() => document.adding('BAD-NAME'));
		assert.equal(document.removing(document.entries[0]!), '# header\r\nB=2\r\n');
	});
	it('rejects stale entry and multiline edits', () => {
		const old = new EnvDocument('A=one\n');
		const entry = old.entries[0]!;
		const changed = new EnvDocument('A=two\n');
		assert.throws(() => changed.setting('overwrite', entry));
		assert.equal(changed.removing(entry), changed.source);
		assert.throws(() => old.setting('one\ntwo', entry));
	});
	it('escaped quote does not end multiline value', () => {
		assert.deepEqual(
			new EnvDocument('A="first\\" line\nB=inside\nlast"\nC=outside\n').entries.map(
				(entry) => entry.name
			),
			['C']
		);
	});
	it('trailing escaped quote does not end multiline value', () => {
		assert.deepEqual(
			new EnvDocument('A="first\\"\nB=inside\nlast"\nC=outside\n').entries.map(
				(entry) => entry.name
			),
			['C']
		);
	});
	it('unsupported duplicate hides all assignments for name', () => {
		const document = new EnvDocument('A=plain\nA="escaped\\n"\nB=visible\n');
		assert.deepEqual(
			document.entries.map((entry) => entry.name),
			['B']
		);
		assert.equal(document.unsupportedLines, 2);
	});
});

describe('ProjectDraftSnapshot', () => {
	const snapshot = (compose: string, environment = ''): ProjectDraftSnapshot => ({
		compose,
		environment
	});

	it('review identifies services and fields without leaking values', () => {
		const old = snapshot(
			'services:\n  web:\n    image: nginx\n    environment:\n      PASSWORD: old-secret\n  retired:\n    image: alpine\n',
			'SECRET=before'
		);
		const draft = snapshot(
			'services:\n  worker:\n    image: alpine\n  web:\n    image: nginx:stable\n    environment:\n      PASSWORD: new-secret\n',
			'SECRET=after'
		);
		assert.deepEqual(ProjectDraftReview.serviceChanges(draft, old), [
			'Removed service: retired',
			'web: environment changed',
			'web: image changed',
			'Added service: worker'
		]);
		assert.ok(!ProjectDraftReview.serviceChanges(draft, old).join('').includes('secret'));
	});
	it('no-op has no review changes or diff', () => {
		const draft = snapshot(
			'# 🐳\r\nservices:\r\n  web:\r\n    image: nginx # unchanged\r\n',
			'SECRET=hidden'
		);
		assert.deepEqual(ProjectDraftReview.serviceChanges(draft, draft), []);
		assert.equal(ProjectDraftReview.sourceDiff(draft, draft), '');
	});
	it('diff contains removed and inserted lines only', () => {
		const old = snapshot('services:\n  web:\n    image: nginx\n# keep\n');
		const draft = snapshot('services:\n  web:\n    image: nginx:stable\n# keep\n');
		assert.equal(
			ProjectDraftReview.sourceDiff(draft, old),
			'-     image: nginx\n+     image: nginx:stable'
		);
		assert.ok(!ProjectDraftReview.sourceDiff(draft, old).includes('# keep'));
	});
	it('comment only change does not claim service mutation', () => {
		const old = snapshot('# first\nservices:\n  web:\n    image: nginx\n');
		const draft = snapshot(old.compose.replace('# first', '# second'));
		assert.deepEqual(ProjectDraftReview.serviceChanges(draft, old), []);
		assert.equal(ProjectDraftReview.sourceDiff(draft, old), '- # first\n+ # second');
	});
	it('invalid raw YAML is rejected before saving', () => {
		const malformed = snapshot('services: [unterminated');
		assert.throws(() => ProjectDraftReview.validateSyntax(malformed));
		assert.deepEqual(ProjectDraftReview.serviceChanges(malformed, snapshot('')), []);
	});
	it('valid advanced YAML remains saveable', () => {
		ProjectDraftReview.validateSyntax(
			snapshot(
				'x-common: &common\n  restart: always\nservices:\n  web:\n    <<: *common\n    image: ${IMAGE:-nginx}\n---\nmetadata: !custom value\n'
			)
		);
	});
	it('async defaults never replace edited or different session drafts', () => {
		const original = snapshot('services: {}');
		const composeEdit = snapshot('services:\n  web:\n    image: nginx');
		const envEdit = snapshot(original.compose, 'TOKEN=keep');
		assert.ok(ProjectDraftReview.canApplyLoadedContent(original, original, 'A', 'A'));
		assert.ok(!ProjectDraftReview.canApplyLoadedContent(original, original, 'A', 'B'));
		assert.ok(!ProjectDraftReview.canApplyLoadedContent(composeEdit, original, 'A', 'A'));
		assert.ok(!ProjectDraftReview.canApplyLoadedContent(envEdit, original, 'A', 'A'));
		assert.ok(!snapshotsEqual(composeEdit, original));
		assert.ok(!snapshotsEqual(envEdit, original));
	});
});

describe('Compose Preview preference', () => {
	it('defaults off and persists for new sessions', () => {
		const store = new Map<string, boolean>();
		assert.ok(!makeComposePreviewSession((key) => store.get(key)).isEnabled);
		store.set(composePreviewPreferenceKey, true);
		assert.ok(makeComposePreviewSession((key) => store.get(key)).isEnabled);
	});
	it('changing preference does not change open sessions', () => {
		const store = new Map<string, boolean>();
		const legacy = makeComposePreviewSession((key) => store.get(key));
		store.set(composePreviewPreferenceKey, true);
		const preview = makeComposePreviewSession((key) => store.get(key));
		store.set(composePreviewPreferenceKey, false);
		assert.ok(!legacy.isEnabled);
		assert.ok(preview.isEnabled);
		assert.ok(!makeComposePreviewSession((key) => store.get(key)).isEnabled);
	});
});
