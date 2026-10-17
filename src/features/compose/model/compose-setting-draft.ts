/**
 * Port of `ComposeSettingDraft` (Types/ComposeSettingDraft.swift): uncommitted
 * form values. Serialization uses the source-preserving editor.
 *
 * Swift's value-type struct becomes an immutable object; the mutating methods
 * return updated copies so React state stays simple.
 */
import { ComposeDocument } from './compose-document';
import { ComposeFormError } from './compose-errors';
import type {
	ComposeFieldPath,
	ComposeFieldPathComponent,
	ComposeNativeKind
} from './compose-native-field';
import { ComposeSchema, preferredKind, type ComposeSchemaField } from './compose-schema';

export type ComposeSettingDraft = {
	readonly id: string;
	name: string;
	kind: ComposeNativeKind;
	value: string;
	children: ComposeSettingDraft[];
	included: boolean;
	readonly schemaPath: ComposeFieldPathComponent[];
};

let nextID = 0;

export function makeSettingDraft(
	name: string,
	schemaPath: ComposeFieldPath,
	included = false
): ComposeSettingDraft {
	const field = ComposeSchema.value(schemaPath);
	let kind = field ? preferredKind(field) : 'string';
	if (field?.kinds.includes('mapping') && ComposeSchema.fields(schemaPath).length > 0)
		kind = 'mapping';
	nextID += 1;
	return {
		id: `draft-${nextID}`,
		name,
		kind,
		value: '',
		children: [],
		included,
		schemaPath: [...schemaPath]
	};
}

export const draftSchema = (draft: ComposeSettingDraft): ComposeSchemaField | undefined =>
	ComposeSchema.value(draft.schemaPath);
export const draftFields = (draft: ComposeSettingDraft): ComposeSchemaField[] =>
	ComposeSchema.fields(draft.schemaPath);
export function isConfigured(draft: ComposeSettingDraft): boolean {
	return draft.included || draft.value !== '' || draft.children.some(isConfigured);
}

export function prepareFields(draft: ComposeSettingDraft): ComposeSettingDraft {
	if (draft.children.length > 0) return draft;
	if (draft.kind === 'mapping') {
		const children = draftFields(draft).map((field) =>
			makeSettingDraft(field.name, [...draft.schemaPath, { key: field.name }])
		);
		const prepared = { ...draft, children };
		return children.length === 0 ? appendEntry(prepared) : prepared;
	}
	if (draft.kind === 'sequence') return appendEntry(draft);
	return draft;
}

export function appendEntry(draft: ComposeSettingDraft): ComposeSettingDraft {
	const path: ComposeFieldPathComponent[] = [
		...draft.schemaPath,
		draft.kind === 'sequence' ? { index: draft.children.length } : { key: 'entry' }
	];
	let entry = makeSettingDraft('', path);
	// Entries in a free-form dictionary start as ordinary name/value pairs.
	if (draft.kind === 'mapping') entry = { ...entry, kind: 'string' };
	entry = prepareFields(entry);
	return { ...draft, children: [...draft.children, entry] };
}

export function addingDraft(
	draft: ComposeSettingDraft,
	source: string,
	parent: ComposeFieldPath,
	newService?: string,
	listItem = false
): string {
	const value = draft.kind === 'boolean' && draft.value === '' ? 'false' : draft.value;
	const options = draftSchema(draft)?.enumValues ?? [];
	if (
		(draft.kind === 'string' || draft.kind === 'number') &&
		options.length > 0 &&
		!options.includes(value)
	) {
		throw ComposeFormError.invalid(`Choose a value for ${draft.name}.`);
	}
	const document = ComposeDocument.parse(source);
	let path: ComposeFieldPathComponent[];
	let result: string;
	if (newService !== undefined) {
		result = document.addingService(newService, draft.name, value, draft.kind);
		path = [{ key: 'services' }, { key: newService }, { key: draft.name }];
	} else {
		const key = listItem ? undefined : draft.name;
		if (!listItem && draft.name === '')
			throw ComposeFormError.invalid('Enter a name for this setting.');
		path = [
			...parent,
			listItem ? { index: document.nativeFields(parent).length } : { key: draft.name }
		];
		result = document.addingNative(value, draft.kind, key, parent);
	}
	return addingChildren(draft, result, path);
}

function addingChildren(
	draft: ComposeSettingDraft,
	source: string,
	path: ComposeFieldPath
): string {
	let result = source;
	for (const child of draft.children) {
		if (isConfigured(child))
			result = addingDraft(child, result, path, undefined, draft.kind === 'sequence');
	}
	return result;
}
