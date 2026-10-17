/**
 * Platform-neutral logic from the Views/Compose SwiftUI views (their computed
 * properties and button/binding closures), shared by the iOS and Android
 * renderings so both edit the source identically.
 */
import { ComposeDocument } from './model/compose-document';
import { ComposeEntryDraft, type ComposeEntryKind } from './model/compose-entry-draft';
import { composeErrorMessage, ComposeFormError } from './model/compose-errors';
import {
	keyPath,
	pathsEqual,
	type ComposeFieldPathComponent,
	type ComposeNativeField,
	type ComposeNativeKind
} from './model/compose-native-field';
import { ComposeFieldOptions } from './model/compose-field-options';
import { EnvDocument, type EnvEntry } from './model/env-document';

/** `mutate`/`change`/`apply`: returns the new text or the error message. */
export function attempt(
	text: string,
	action: (document: ComposeDocument) => string
): { text: string } | { error: string } {
	try {
		return { text: action(ComposeDocument.parse(text)) };
	} catch (error) {
		return { error: composeErrorMessage(error) };
	}
}

export const validName = (value: string) => value !== '' && /^[A-Za-z0-9_.-]+$/.test(value);

// MARK: - ComposePreviewEditor

export const projectResourceKeys = [
	'services',
	'volumes',
	'networks',
	'build',
	'deploy',
	'x-arcane'
];

export function parseError(text: string): string {
	try {
		ComposeDocument.parse(text);
		return 'This document requires YAML editing.';
	} catch (error) {
		return composeErrorMessage(error);
	}
}

export function resourceSummary(document: ComposeDocument, kind: string): string {
	const names = document.nativeFields([{ key: kind }]).map((field) => field.name);
	return names.length === 0 ? 'No entries' : names.join(', ');
}

export function removingServices(text: string, services: readonly string[]): string {
	let source = text;
	for (const service of [...services].reverse()) {
		source = ComposeDocument.parse(source).removingNative([{ key: 'services' }, { key: service }]);
	}
	return source;
}

export function serviceImage(document: ComposeDocument, service: string): string | undefined {
	const field = document.nativeField([{ key: 'services' }, { key: service }, { key: 'image' }]);
	return field.kind === 'string' && field.value !== '' ? field.value : undefined;
}

// MARK: - ComposeServiceForm

export const primaryServiceFields = new Set([
	'image',
	'pull_policy',
	'ports',
	'volumes',
	'networks',
	'environment',
	'env_file',
	'labels',
	'healthcheck',
	'restart',
	'command',
	'entrypoint',
	'container_name',
	'hostname',
	'domainname',
	'extra_hosts',
	'dns',
	'dns_opt',
	'dns_search'
]);

export class ServiceFormModel {
	readonly document: ComposeDocument | undefined;
	readonly path: string[];
	readonly existingFields: Set<string>;

	constructor(text: string, service: string) {
		this.document = ComposeDocument.tryParse(text);
		this.path = ['services', service];
		this.existingFields = new Set(
			(this.document?.nativeFields(keyPath(this.path)) ?? []).map((field) => field.name)
		);
	}
	get additionalFields(): string[] {
		return [...this.existingFields]
			.filter((name) => !primaryServiceFields.has(name) && name !== 'x-arcane')
			.sort();
	}
	has(key: string) {
		return this.existingFields.has(key);
	}
	hasAny(keys: string[]) {
		return keys.some((key) => this.existingFields.has(key));
	}
	value(key: string) {
		return this.scalarValue([...this.path, key]);
	}
	scalarValue(fieldPath: string[]): string | undefined {
		const field = this.document?.nativeField(keyPath(fieldPath));
		if (!field || !['string', 'number', 'boolean'].includes(field.kind)) return undefined;
		return field.value;
	}
	countSummary(key: string, singular: string, plural: string): string {
		const document = this.document;
		if (!document) return 'Not configured';
		const fieldPath = keyPath([...this.path, key]);
		const field = document.nativeField(fieldPath);
		if (field.kind === 'mapping' || field.kind === 'sequence') {
			const count = document.nativeFields(fieldPath).length;
			return `${count} ${count === 1 ? singular : plural}`;
		}
		if (field.kind === 'null') return 'Not configured';
		if (field.kind === 'unsupported') return 'Configured';
		return '1 ' + singular;
	}
	get healthcheckSummary(): string {
		const health = [...this.path, 'healthcheck'];
		if (!this.has('healthcheck')) return 'Not configured';
		if (this.scalarValue([...health, 'disable'])?.toLowerCase() === 'true') return 'Disabled';
		const interval = this.scalarValue([...health, 'interval']);
		if (interval !== undefined) return 'Every ' + interval;
		return 'Configured';
	}
	get runtimeSummary(): string {
		return this.has('restart')
			? 'Restart: ' + (this.value('restart') ?? 'Default')
			: this.has('command')
				? 'Custom command'
				: 'Custom entrypoint';
	}
	get identitySummary(): string {
		return (
			this.value('container_name') ??
			this.value('hostname') ??
			this.value('domainname') ??
			'Configured'
		);
	}
	isSequence(key: string) {
		return this.document?.nativeField(keyPath([...this.path, key])).kind === 'sequence';
	}
}

/** `ComposeServiceForm.policy` setter. */
export function settingPolicy(text: string, path: string[], key: string, selected: string): string {
	const document = ComposeDocument.parse(text);
	if (selected === '') {
		const parent = keyPath(path);
		if (document.nativeFields(parent).some((field) => field.name === key))
			return document.removingNative([...parent, { key }]);
		return text;
	}
	return document.settingNative(selected, 'string', keyPath([...path, key]));
}

export function policyOptions(text: string, path: string[], key: string) {
	const options = new ComposeFieldOptions(keyPath([...path, key]));
	const current = new ServiceFormModel(text, path[1] ?? '').value(key) ?? '';
	return { options, current, custom: current !== '' && !options.values.includes(current) };
}

// MARK: - ComposeScalarField / ComposeBooleanField

export function scalarFieldState(text: string, path: string[]) {
	const nativePath = keyPath(path);
	const field = ComposeDocument.tryParse(text)?.nativeField(nativePath);
	const editable =
		field !== undefined && ['string', 'number', 'boolean', 'null'].includes(field.kind);
	return {
		editable,
		value: field?.kind === 'null' ? '' : (field?.value ?? ''),
		options: new ComposeFieldOptions(nativePath)
	};
}

export function settingScalar(
	text: string,
	path: string[],
	value: string,
	integer: boolean
): string {
	const nativePath = keyPath(path);
	const document = ComposeDocument.parse(text);
	if (integer && value === '') {
		if (
			document
				.nativeFields(nativePath.slice(0, -1))
				.some((field) => pathsEqual(field.path, nativePath))
		)
			return document.removingNative(nativePath);
		return text;
	}
	if (integer) {
		const number = /^[+-]?[0-9]+$/.test(value) ? Number(value) : undefined;
		if (number === undefined || number < 0)
			throw ComposeFormError.invalid('Enter a nonnegative whole number.');
	}
	return document.settingNative(value, integer ? 'number' : 'string', nativePath);
}

export function booleanFieldState(text: string, path: string[], defaultValue: boolean) {
	const field = ComposeDocument.tryParse(text)?.nativeField(keyPath(path));
	const editable =
		field?.kind === 'boolean' ||
		field?.kind === 'null' ||
		field?.value === 'true' ||
		field?.value === 'false';
	return { editable, isOn: field?.kind === 'null' ? defaultValue : field?.value === 'true' };
}

export function settingBoolean(text: string, path: string[], enabled: boolean): string {
	return ComposeDocument.parse(text).settingNative(String(enabled), 'boolean', keyPath(path));
}

// MARK: - ComposeMappingForm

export function mappingNativeFallback(
	document: ComposeDocument | undefined,
	path: string[]
): boolean {
	if (!document) return false;
	const typed = keyPath(path);
	const kind = document.nativeField(typed).kind;
	if (kind !== 'mapping' && kind !== 'sequence') return false;
	return (
		!document.isEditable(path) ||
		document.rawValue(path) === undefined ||
		document
			.nativeFields(typed)
			.some((field) => field.kind === 'mapping' || field.kind === 'sequence')
	);
}

export function removingKeys(text: string, path: string[], keys: readonly string[]): string {
	let source = text;
	for (const key of [...keys].reverse())
		source = ComposeDocument.parse(source).removing([...path, key]);
	return source;
}

export function addingMappingEntry(
	document: ComposeDocument,
	path: string[],
	name: string
): string {
	if (document.keys(path).includes(name)) throw ComposeFormError.duplicate;
	return document.setting('""', [...path, name]);
}

// MARK: - ComposeCollectionForm

export function collectionNativeFallback(
	document: ComposeDocument | undefined,
	path: string[]
): boolean {
	if (!document) return false;
	const kind = document.nativeField(keyPath(path)).kind;
	return (
		kind === 'sequence' && (!document.isEditable(path) || document.rawValue(path) === undefined)
	);
}

export function collectionItems(
	document: ComposeDocument | undefined,
	path: string[]
): string[] | undefined {
	if (!document || !document.isEditable(path)) return undefined;
	if (document.items(path) === undefined && document.rawValue(path) !== undefined) return undefined;
	return document.items(path) ?? [];
}

export function entryName(raw: string): string {
	const value = ComposeDocument.tryParse('entry: ' + raw)?.scalar(['entry']) ?? raw;
	// `split(separator: "=", maxSplits: 1).first` (empty pieces are omitted).
	if (value.startsWith('=')) return value.slice(1);
	const separator = value.indexOf('=');
	return separator === -1 ? value : value.slice(0, separator);
}

export type EntrySelection = { id: string; index?: number; raw: string };

/** The `ComposeEntrySheet` save closure in `ComposeCollectionForm`; returns the new text. */
export function savingCollectionEntry(
	text: string,
	path: string[],
	kind: ComposeEntryKind,
	selection: EntrySelection,
	raw: string,
	externalResource: string | undefined
): string | undefined {
	if (selection.index !== undefined && raw === selection.raw && externalResource === undefined)
		return undefined;
	let source = text;
	if (externalResource !== undefined) {
		if (kind === 'mount') {
			const mountType = ComposeDocument.parse(raw).scalar(['type']);
			if (mountType !== undefined && mountType !== 'volume') {
				throw ComposeFormError.invalid(
					`This mount uses ${mountType}. Change its type to volume in All settings before selecting an existing volume.`
				);
			}
		}
		const resourcePath = [kind === 'mount' ? 'volumes' : 'networks', externalResource];
		const existing = ComposeDocument.parse(source);
		if (existing.rawValue(resourcePath) === undefined) {
			source = existing.setting('external: true', resourcePath);
		} else if (existing.scalar([...resourcePath, 'external']) !== 'true') {
			throw ComposeFormError.invalid(
				'This name already has a project resource definition. Configure it as external in Project resources before selecting the existing Docker resource.'
			);
		}
	}
	if (externalResource === undefined && (kind === 'mount' || kind === 'network')) {
		let entry: ComposeEntryDraft | undefined;
		try {
			entry = new ComposeEntryDraft(raw, kind);
		} catch {
			entry = undefined;
		}
		if (entry) {
			const name = entry.source;
			const named =
				kind === 'network' ||
				(name !== '' && !name.startsWith('/') && !name.startsWith('.') && !name.startsWith('~'));
			if (named) {
				const root = kind === 'mount' ? 'volumes' : 'networks';
				const existing = ComposeDocument.parse(source);
				if (!existing.keys([root]).includes(name)) source = existing.setting('{}', [root, name]);
			}
		}
	}
	const current = ComposeDocument.parse(source);
	if (selection.index !== undefined) {
		const items = current.items(path);
		if (!items || items[selection.index] !== selection.raw) throw ComposeFormError.changed;
		return current.settingItem(raw, path, selection.index);
	}
	return current.appendingItem(raw, path);
}

export function removingItems(text: string, path: string[], indices: readonly number[]): string {
	let source = text;
	for (const index of [...indices].sort((a, b) => b - a))
		source = ComposeDocument.parse(source).removingItem(path, index);
	return source;
}

/** `ComposeEntrySheet` "All settings": wraps the entry so native fields can edit it. */
export const entryWrapper = (raw: string) =>
	'entry:\n' +
	raw
		.split('\n')
		.map((line) => '  ' + line)
		.join('\n');

/** `ComposeEntrySheet.applyNativeSettings`. */
export function rawFromWrapper(wrapper: string): string {
	const raw = ComposeDocument.parse(wrapper).rawValue(['entry']);
	if (raw === undefined) throw ComposeFormError.invalid('The entry cannot be empty.');
	return raw;
}

// MARK: - ComposeStringListForm

export function stringListNeedsNativeFields(
	document: ComposeDocument | undefined,
	path: string[]
): boolean {
	if (!document) return false;
	const typed = keyPath(path);
	const kind = document.nativeField(typed).kind;
	if (kind === 'sequence' && new ComposeFieldOptions([...typed, { index: 0 }]).values.length > 0)
		return true;
	return (
		kind !== 'null' &&
		(!document.isEditable(path) ||
			document.rawValue(path) === undefined ||
			(kind === 'string' && document.scalar(path) === undefined))
	);
}

export const decodedItem = (raw: string) =>
	ComposeDocument.tryParse('value: ' + raw)?.scalar(['value']);

export function addingStringValue(
	document: ComposeDocument,
	path: string[],
	newValue: string
): string {
	const scalar = document.scalar(path);
	if (scalar !== undefined) {
		return document.setting(
			'- ' + ComposeDocument.quoted(scalar) + '\n- ' + ComposeDocument.quoted(newValue),
			path
		);
	}
	return document.appendingItem(ComposeDocument.quoted(newValue), path);
}

// MARK: - ComposeNetworkAttachmentsForm

export function attachmentNames(
	document: ComposeDocument | undefined,
	path: string[]
): string[] | undefined {
	if (!document) return undefined;
	const items = document.items(path);
	if (items) {
		const values = items.flatMap((item) => {
			const name = ComposeDocument.tryParse('name: ' + item)?.scalar(['name']);
			return name === undefined ? [] : [name];
		});
		return values.length === items.length ? values : undefined;
	}
	const nativePath = keyPath(path);
	if (!['mapping', 'null'].includes(document.nativeField(nativePath).kind)) return undefined;
	return document.nativeFields(nativePath).map((field) => field.name);
}

export function removingAttachments(
	text: string,
	path: string[],
	names: readonly string[],
	indices: readonly number[]
): string {
	let source = text;
	for (const index of [...indices].sort((a, b) => b - a)) {
		const current = ComposeDocument.parse(source);
		if (current.items(path) !== undefined) source = current.removingItem(path, index);
		else source = current.removingNative(keyPath([...path, names[index]!]));
	}
	return source;
}

export function addingAttachment(
	document: ComposeDocument,
	path: string[],
	name: string,
	names: readonly string[],
	externalResource: string | undefined
): string {
	if (names.includes(name)) throw ComposeFormError.duplicate;
	let source =
		document.items(path) !== undefined
			? document.appendingItem(ComposeDocument.quoted(name), path)
			: document.addingNative('', 'mapping', name, keyPath(path));
	const updated = ComposeDocument.parse(source);
	if (externalResource === name) {
		if (updated.rawValue(['networks', name]) === undefined)
			source = updated.setting('external: true', ['networks', name]);
		else if (updated.scalar(['networks', name, 'external']) !== 'true')
			throw ComposeFormError.invalid('This name already has a project network definition.');
	} else if (!updated.keys(['networks']).includes(name)) {
		source = updated.setting('{}', ['networks', name]);
	}
	return source;
}

export const fieldNames = (text: string, path: ComposeFieldPathComponent[]) =>
	new Set((ComposeDocument.tryParse(text)?.nativeFields(path) ?? []).map((field) => field.name));

// MARK: - ComposeNativeFieldsForm

export function savingNativeField(
	text: string,
	field: ComposeNativeField,
	kind: ComposeNativeKind,
	value: string
): string {
	const document = ComposeDocument.parse(text);
	const current = document.nativeField(field.path);
	if (current.kind !== field.kind || current.value !== field.value) throw ComposeFormError.changed;
	return document.settingNative(value, kind, field.path);
}

export function removingNativeFields(
	text: string,
	fields: readonly ComposeNativeField[],
	indices: readonly number[]
): string {
	let result = text;
	for (const index of [...indices].sort((a, b) => b - a))
		result = ComposeDocument.parse(result).removingNative(fields[index]!.path);
	return result;
}

/** Swift `String.count`: grapheme clusters where the engine can segment them. */
function characterCount(value: string): number {
	const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
	if (Segmenter) return Array.from(new Segmenter().segment(value)).length;
	return Array.from(value).length;
}

export const editsInline = (field: ComposeNativeField) =>
	(field.kind === 'string' || field.kind === 'number') &&
	!field.value.includes('\n') &&
	!field.value.includes('\r') &&
	characterCount(field.value) <= 160;

// MARK: - ComposeResourceDefinitionList

export function addingResource(text: string, kind: string, name: string): string {
	const document = ComposeDocument.parse(text);
	if (document.nativeFields([{ key: kind }]).some((field) => field.name === name))
		throw ComposeFormError.duplicate;
	return document.addingNative('', 'mapping', name, [{ key: kind }]);
}

export function removingResources(text: string, kind: string, indices: readonly number[]): string {
	const names = ComposeDocument.parse(text)
		.nativeFields([{ key: kind }])
		.map((field) => field.name);
	let source = text;
	for (const index of [...indices].sort((a, b) => b - a)) {
		source = ComposeDocument.parse(source).removingNative([{ key: kind }, { key: names[index]! }]);
	}
	return source;
}

// MARK: - EnvPreviewEditor

export function settingEnvValue(text: string, entry: EnvEntry, value: string): string {
	const document = new EnvDocument(text);
	const current = document.entries.find((candidate) => candidate.name === entry.name);
	if (!current) throw ComposeFormError.changed;
	return document.setting(value, current);
}

export function removingEnvEntries(
	text: string,
	entries: readonly EnvEntry[],
	indices: readonly number[]
): string {
	let source = text;
	for (const index of [...indices].sort((a, b) => b - a))
		source = new EnvDocument(source).removing(entries[index]!);
	return source;
}
