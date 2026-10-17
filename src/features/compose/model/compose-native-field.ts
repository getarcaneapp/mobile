export type ComposeFieldPathComponent = { key: string } | { index: number };
export type ComposeFieldPath = readonly ComposeFieldPathComponent[];

export const key = (name: string): ComposeFieldPathComponent => ({ key: name });
export const index = (value: number): ComposeFieldPathComponent => ({ index: value });
export const keyPath = (path: readonly string[]): ComposeFieldPathComponent[] => path.map(key);

export function isKey(
	component: ComposeFieldPathComponent | undefined
): component is { key: string } {
	return component !== undefined && 'key' in component;
}

export function componentsEqual(a: ComposeFieldPathComponent, b: ComposeFieldPathComponent) {
	return isKey(a) ? isKey(b) && a.key === b.key : !isKey(b) && a.index === b.index;
}
export function pathsEqual(a: ComposeFieldPath, b: ComposeFieldPath) {
	return a.length === b.length && a.every((component, i) => componentsEqual(component, b[i]!));
}
export function pathID(path: ComposeFieldPath) {
	return JSON.stringify(
		path.map((component) => (isKey(component) ? ['k', component.key] : ['i', component.index]))
	);
}
export function pathFromID(id: string): ComposeFieldPathComponent[] {
	const raw = JSON.parse(id) as [string, string | number][];
	return raw.map(([kind, value]) =>
		kind === 'k' ? { key: String(value) } : { index: Number(value) }
	);
}

export type ComposeNativeKind =
	| 'string'
	| 'number'
	| 'boolean'
	| 'null'
	| 'mapping'
	| 'sequence'
	| 'unsupported';

export const nativeKindTitle: Record<ComposeNativeKind, string> = {
	string: 'Text',
	number: 'Number',
	boolean: 'Boolean',
	null: 'Empty',
	mapping: 'Object',
	sequence: 'List',
	unsupported: 'Preserved'
};
export const allNativeKinds: ComposeNativeKind[] = [
	'string',
	'number',
	'boolean',
	'null',
	'mapping',
	'sequence',
	'unsupported'
];
export const editableNativeKinds: ComposeNativeKind[] = allNativeKinds.filter(
	(kind) => kind !== 'unsupported'
);

export type ComposeNativeField = {
	name: string;
	path: ComposeFieldPathComponent[];
	kind: ComposeNativeKind;
	value: string;
};
