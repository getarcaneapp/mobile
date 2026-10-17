/**
 * Port of `ComposeSchema` (pkg/utils/compose/ComposeSchema.swift) and
 * `ComposeSchemaField` (Types/ComposeSchemaField.swift): field suggestions from
 * the bundled upstream Compose schema, never a serialization format.
 */
import arcaneMetadata from '../../../../assets/ComposeSchema/arcane-metadata.json';
import composeSpec from '../../../../assets/ComposeSchema/compose-spec.json';
import {
	editableNativeKinds,
	isKey,
	type ComposeFieldPath,
	type ComposeNativeKind
} from './compose-native-field';

type SchemaValue =
	| null
	| boolean
	| number
	| string
	| SchemaValue[]
	| { [key: string]: SchemaValue };
type SchemaObject = { [key: string]: SchemaValue };

const object = (value: SchemaValue | undefined): SchemaObject =>
	value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
		? value
		: {};
const array = (value: SchemaValue | undefined): SchemaValue[] =>
	Array.isArray(value) ? value : [];
const string = (value: SchemaValue | undefined) => (typeof value === 'string' ? value : undefined);
function literal(value: SchemaValue | undefined): string | undefined {
	if (typeof value === 'string') return value;
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	if (typeof value === 'number') return Number.isInteger(value) ? value.toFixed(0) : String(value);
	if (value === null) return 'null';
	return undefined;
}

export type ComposeSchemaField = {
	name: string;
	description: string;
	kinds: ComposeNativeKind[];
	enumValues: string[];
};

const sameKinds = (a: readonly ComposeNativeKind[], b: readonly ComposeNativeKind[]) =>
	a.length === b.length && a.every((kind, i) => kind === b[i]);

/** `ComposeSchemaField.preferredKind`: prefer native controls; text remains available for interpolation. */
export function preferredKind(field: ComposeSchemaField): ComposeNativeKind {
	if (sameKinds(field.kinds, editableNativeKinds)) return 'string';
	if (field.enumValues.length > 0 && field.kinds.includes('string')) return 'string';
	if (field.kinds.includes('boolean')) return 'boolean';
	if (field.kinds.includes('number')) return 'number';
	return field.kinds.includes('string') ? 'string' : (field.kinds[0] ?? 'string');
}

export const ComposeSchema = (() => {
	const revision = '914ec15d1fa498969c0df5c1d672306db3256089';

	const root: SchemaValue = (() => {
		const compose = composeSpec as unknown as SchemaObject;
		const metadata = arcaneMetadata as unknown as SchemaObject;
		const result: SchemaObject = { ...compose };
		result.properties = { ...object(compose.properties), 'x-arcane': metadata.project ?? null };
		const definitions = { ...object(compose.$defs) };
		const service = { ...object(definitions.service) };
		service.properties = { ...object(service.properties), 'x-arcane': metadata.service ?? null };
		definitions.service = service;
		result.$defs = definitions;
		return result;
	})();

	function resolve(reference: string): SchemaValue | undefined {
		if (!reference.startsWith('#/')) return undefined;
		let value: SchemaValue | undefined = root;
		for (const token of reference.slice(2).split('/')) {
			const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
			const next: SchemaValue | undefined = object(value)[key];
			if (next === undefined) return undefined;
			value = next;
		}
		return value;
	}

	function expanded(
		schema: SchemaValue,
		references: ReadonlySet<string> = new Set()
	): SchemaValue[] {
		const result: SchemaValue[] = [schema];
		const node = object(schema);
		const reference = string(node.$ref);
		if (reference !== undefined && !references.has(reference)) {
			const target = resolve(reference);
			if (target !== undefined)
				result.push(...expanded(target, new Set([...references, reference])));
		}
		for (const combinator of ['allOf', 'oneOf', 'anyOf']) {
			for (const branch of array(node[combinator])) result.push(...expanded(branch, references));
		}
		return result;
	}

	function schemas(path: ComposeFieldPath): SchemaValue[] {
		let current = expanded(root);
		for (const component of path) {
			current = current.flatMap((schema) => {
				const node = object(schema);
				if (isKey(component)) {
					const matches: SchemaValue[] = [];
					const explicit = object(node.properties)[component.key];
					if (explicit !== undefined) matches.push(explicit);
					for (const [pattern, value] of Object.entries(object(node.patternProperties))) {
						if (new RegExp(pattern).test(component.key)) matches.push(value);
					}
					const additional = node.additionalProperties;
					if (matches.length === 0 && additional !== undefined) {
						if (additional !== null && typeof additional === 'object' && !Array.isArray(additional))
							matches.push(additional);
						else if (additional === true) matches.push({});
					}
					return matches.flatMap((match) => expanded(match));
				}
				const items = node.items;
				if (component.index < 0 || items === undefined) return [];
				if (Array.isArray(items)) {
					const tuple = items[component.index];
					return tuple === undefined ? [] : expanded(tuple);
				}
				return expanded(items);
			});
		}
		return current;
	}

	function field(name: string, nodes: SchemaValue[]): ComposeSchemaField | undefined {
		if (nodes.length === 0) return undefined;
		const variants = nodes.flatMap((node) => expanded(node));
		let kinds: ComposeNativeKind[] = [];
		const choices: string[] = [];
		let description = '';
		for (const variant of variants) {
			const node = object(variant);
			if (description === '') description = string(node.description) ?? '';
			const type = node.type;
			const types =
				type === undefined
					? []
					: typeof type === 'string'
						? [type]
						: array(type).flatMap((t) => (typeof t === 'string' ? [t] : []));
			for (const entry of types) {
				const kind: ComposeNativeKind | undefined = (
					{
						string: 'string',
						integer: 'number',
						number: 'number',
						boolean: 'boolean',
						null: 'null',
						object: 'mapping',
						array: 'sequence'
					} as Record<string, ComposeNativeKind>
				)[entry];
				if (kind && !kinds.includes(kind)) kinds.push(kind);
			}
			if (node.properties !== undefined && !kinds.includes('mapping')) kinds.push('mapping');
			if (node.items !== undefined && !kinds.includes('sequence')) kinds.push('sequence');
			const literals = [
				...array(node.enum).flatMap((v) => (literal(v) === undefined ? [] : [literal(v)!])),
				...(node.const !== undefined && literal(node.const) !== undefined
					? [literal(node.const)!]
					: [])
			];
			for (const choice of literals) if (!choices.includes(choice)) choices.push(choice);
		}
		if (kinds.length === 0) kinds = [...editableNativeKinds];
		return { name, description, kinds, enumValues: choices };
	}

	const fieldsCache = new Map<string, ComposeSchemaField[]>();
	const valueCache = new Map<string, ComposeSchemaField | null>();
	const cacheKey = (path: ComposeFieldPath) => JSON.stringify(path);

	return {
		revision,
		fields(path: ComposeFieldPath): ComposeSchemaField[] {
			const id = cacheKey(path);
			const cached = fieldsCache.get(id);
			if (cached) return cached;
			const variants = schemas(path);
			const names = [
				...new Set(variants.flatMap((variant) => Object.keys(object(object(variant).properties))))
			].sort();
			const result = names.flatMap((name) => {
				const nodes = variants.flatMap((variant) => {
					const value = object(object(variant).properties)[name];
					return value === undefined ? [] : [value];
				});
				const resolved = field(name, nodes);
				return resolved ? [resolved] : [];
			});
			fieldsCache.set(id, result);
			return result;
		},
		value(path: ComposeFieldPath): ComposeSchemaField | undefined {
			const id = cacheKey(path);
			if (valueCache.has(id)) return valueCache.get(id) ?? undefined;
			const last = path[path.length - 1];
			const name = isKey(last) ? last.key : 'Value';
			const result = field(name, schemas(path));
			valueCache.set(id, result ?? null);
			return result;
		},
		/** The merged root (`snapshot()` in the Swift tests). */
		rootSnapshot: () => composeSpec as unknown
	};
})();
