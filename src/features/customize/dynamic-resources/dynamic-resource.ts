import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { QueryItem } from '@/sdk/client/url';

export type JSONValue =
	| string
	| number
	| boolean
	| null
	| JSONValue[]
	| { [key: string]: JSONValue };

export type JSONObject = { [key: string]: JSONValue };

export function isJSONObject(value: JSONValue | undefined): value is JSONObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function jsonDisplayString(value: JSONValue): string {
	if (value === null) return 'None';
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return Number.isInteger(value) ? value.toFixed(0) : String(value);
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	if (Array.isArray(value)) return `${value.length} items`;
	return `${Object.keys(value).length} fields`;
}

export function standardCompare(lhs: string, rhs: string): number {
	return lhs.localeCompare(rhs, undefined, { numeric: true, sensitivity: 'base' });
}

export function caseInsensitiveContains(text: string, query: string): boolean {
	return text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

export interface DynamicResource {
	id: string;
	values: JSONObject;
}

const idKeys = [
	'id',
	'ID',
	'name',
	'Name',
	'serviceId',
	'nodeId',
	'taskId',
	'repositoryUrl',
	'url'
];
const titleKeys = [
	'name',
	'Name',
	'title',
	'Title',
	'id',
	'ID',
	'serviceName',
	'containerName',
	'repositoryUrl',
	'url'
];
const subtitleKeys = [
	'description',
	'status',
	'state',
	'image',
	'path',
	'url',
	'message',
	'type',
	'eventType',
	'composePath',
	'backupDirectory'
];
const statusKeys = [
	'status',
	'state',
	'enabled',
	'isEnabled',
	'active',
	'isActive',
	'availability'
];

function stableHash(text: string): string {
	let hash = 5381;
	for (let index = 0; index < text.length; index++)
		hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
	return String(hash >>> 0);
}

function resolveID(values: JSONObject): string {
	for (const key of idKeys) {
		const value = values[key];
		if (value !== undefined) {
			const text = jsonDisplayString(value);
			if (text !== '') return text;
		}
	}
	return stableHash(JSON.stringify(values));
}

function firstDisplay(values: JSONObject, keys: string[], skip?: string): string | undefined {
	for (const key of keys) {
		const value = values[key];
		if (value === undefined) continue;
		const text = jsonDisplayString(value);
		if (text !== '' && text !== skip) return text;
	}
	return undefined;
}

export const DynamicResource = {
	make(this: void, id: string, values: JSONObject): DynamicResource {
		return { id, values };
	},

	decode(this: void, raw: unknown): DynamicResource {
		const values: JSONObject =
			typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as JSONObject) : {};
		return { id: resolveID(values), values };
	},

	title(this: void, resource: DynamicResource): string {
		return firstDisplay(resource.values, titleKeys) ?? resource.id;
	},

	subtitle(this: void, resource: DynamicResource): string {
		return (
			firstDisplay(resource.values, subtitleKeys, DynamicResource.title(resource)) ?? resource.id
		);
	},

	statusText(this: void, resource: DynamicResource): string | undefined {
		for (const key of statusKeys) {
			const value = resource.values[key];
			if (value !== undefined) return jsonDisplayString(value);
		}
		return undefined;
	},

	sortedDetails(this: void, resource: DynamicResource): [string, JSONValue][] {
		return Object.entries(resource.values)
			.filter(([key]) => {
				const lower = key.toLowerCase();
				return !lower.includes('password') && !lower.includes('token') && !lower.includes('secret');
			})
			.sort(([lhs], [rhs]) => standardCompare(lhs, rhs));
	}
} as const;

export function prettyKey(raw: string): string {
	return raw
		.replace(/_/g, ' ')
		.replace(/-/g, ' ')
		.split(' ')
		.filter((word) => word !== '')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

export type BackendFieldType =
	| { kind: 'text' }
	| { kind: 'secure' }
	| { kind: 'multiline' }
	| { kind: 'toggle' }
	| { kind: 'number' }
	| { kind: 'choice'; options: string[] };

export interface BackendFormField {
	id: string;
	label: string;
	type: BackendFieldType;
	required: boolean;
	placeholder: string;
}

export function backendFormField(
	id: string,
	label: string,
	options: { type?: BackendFieldType; required?: boolean; placeholder?: string } = {}
): BackendFormField {
	return {
		id,
		label,
		type: options.type ?? { kind: 'text' },
		required: options.required ?? false,
		placeholder: options.placeholder ?? ''
	};
}

export type BackendMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface DynamicEditConfig {
	title: string;
	fields: BackendFormField[];
	method: BackendMethod;
}

export function dynamicEditConfig(
	title: string,
	fields: BackendFormField[],
	method: BackendMethod = 'PUT'
): DynamicEditConfig {
	return { title, fields, method };
}

export interface BackendListAction {
	id: string;
	title: string;
	systemImage: string;
	method: BackendMethod;
	pathSuffix: string;
	destructive: boolean;
	requiresSelection: boolean;
}

export function backendListAction(args: {
	id: string;
	title: string;
	systemImage: string;
	method: BackendMethod;
	pathSuffix: string;
	destructive?: boolean;
	requiresSelection?: boolean;
}): BackendListAction {
	return {
		...args,
		destructive: args.destructive ?? false,
		requiresSelection: args.requiresSelection ?? true
	};
}

export function escapedPathComponent(value: string): string {
	return encodeURIComponent(value).replace(/%(2[146-9ABC]|3[ABD]|40)/g, (match) =>
		decodeURIComponent(match)
	);
}

export function splitPath(path: string): { path: string; query: QueryItem[] } {
	const index = path.indexOf('?');
	if (index < 0) return { path, query: [] };
	const query: QueryItem[] = [];
	for (const pair of path.slice(index + 1).split('&')) {
		if (pair === '') continue;
		const [name = '', value] = pair.split('=');
		query.push({
			name: decodeURIComponent(name),
			value: value === undefined ? undefined : decodeURIComponent(value)
		});
	}
	return { path: path.slice(0, index), query };
}

export function sendRequest(
	client: ArcaneClient,
	path: string,
	method: BackendMethod,
	body?: Record<string, unknown>
): Promise<string> {
	const { path: bare, query } = splitPath(path);
	if (method === 'GET') return client.transport.rawRequest(bare, { query });
	return client.transport.rawRequest(bare, { method, query, body });
}

export function formBody(
	values: Record<string, string>,
	toggles: Record<string, boolean>,
	fields: BackendFormField[]
): Record<string, unknown> {
	const object: Record<string, unknown> = {};
	for (const field of fields) {
		const raw = (values[field.id] ?? '').trim();
		switch (field.type.kind) {
			case 'toggle':
				object[field.id] = toggles[field.id] ?? false;
				break;
			case 'number': {
				const number = Number(raw);
				if (raw !== '' && Number.isFinite(number)) object[field.id] = number;
				else if (raw !== '') object[field.id] = raw;
				break;
			}
			default:
				if (raw !== '') object[field.id] = raw;
		}
	}
	return object;
}

const choiceAcronyms = new Set(['http', 'https', 'ssh', 'tls', 'oidc', 's3']);

export function choiceLabel(option: string): string {
	if (choiceAcronyms.has(option.toLowerCase())) return option.toUpperCase();
	return option.charAt(0).toUpperCase() + option.slice(1);
}
