/**
 * Port of `SwarmServiceSpecDraft` (Types/Swarm/SwarmServiceSpecDraft.swift):
 * an editable view of a Docker swarm `ServiceSpec`. Edits are applied back
 * onto the original spec JSON so fields the form doesn't expose (resources,
 * placement, update config, secrets, …) survive a round trip.
 */
import type { JSONValue } from '@/sdk/types/json';

import { swarmArray, swarmField, swarmObject, swarmString, type JSONObject } from './swarm-common';

export type SwarmServiceMode = 'replicated' | 'global' | 'job';

export type DraftPort = { id: string; target: string; published: string; proto: string };
export type DraftMount = {
	id: string;
	type: string;
	source: string;
	target: string;
	readOnly: boolean;
};
export type DraftPair = { id: string; key: string; value: string };

export type SwarmServiceSpecDraft = {
	name: string;
	image: string;
	mode: SwarmServiceMode;
	replicas: number;
	ports: DraftPort[];
	env: DraftPair[];
	mounts: DraftMount[];
	labels: DraftPair[];
	command: string;
	args: string;
	workingDir: string;
	user: string;
	hostname: string;
};

let nextID = 0;
const uuid = () => `draft-${Date.now().toString(36)}-${nextID++}`;

export const newPort = (): DraftPort => ({ id: uuid(), target: '', published: '', proto: 'tcp' });
export const newMount = (): DraftMount => ({
	id: uuid(),
	type: 'volume',
	source: '',
	target: '',
	readOnly: false
});
export const newPair = (): DraftPair => ({ id: uuid(), key: '', value: '' });

const trimmed = (value: string) => value.trim();

export function emptyDraft(): SwarmServiceSpecDraft {
	return {
		name: '',
		image: '',
		mode: 'replicated',
		replicas: 1,
		ports: [],
		env: [],
		mounts: [],
		labels: [],
		command: '',
		args: '',
		workingDir: '',
		user: '',
		hostname: ''
	};
}

/** `numberString(_:)`. */
export function numberString(value: JSONValue | undefined): string {
	if (typeof value !== 'number' || !Number.isFinite(value)) return '';
	return String(Math.trunc(value));
}

/** Joins argv for display, quoting arguments that contain whitespace. */
export function joinArguments(value: JSONValue | undefined): string {
	return (swarmArray(value) ?? [])
		.map(swarmString)
		.filter((v): v is string => v !== undefined)
		.map((argument) =>
			/\s/.test(argument) || argument === '' ? `"${argument.replace(/"/g, '\\"')}"` : argument
		)
		.join(' ');
}

/** Splits a command line into argv, honouring single and double quotes. */
export function splitArguments(line: string): string[] {
	const args: string[] = [];
	let current = '';
	let quote: string | undefined;
	let hasToken = false;
	let escaping = false;
	for (const character of line) {
		if (escaping) {
			current += character;
			escaping = false;
			continue;
		}
		if (character === '\\' && quote !== "'") {
			escaping = true;
			hasToken = true;
			continue;
		}
		if (quote !== undefined) {
			if (character === quote) quote = undefined;
			else current += character;
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			hasToken = true;
		} else if (/\s/.test(character)) {
			if (hasToken) {
				args.push(current);
				current = '';
				hasToken = false;
			}
		} else {
			current += character;
			hasToken = true;
		}
	}
	if (hasToken) args.push(current);
	return args;
}

export function draftFromSpec(spec: JSONValue): SwarmServiceSpecDraft {
	const object = swarmObject(spec) ?? {};
	const containerSpec =
		swarmObject(swarmField(swarmField(spec, 'TaskTemplate'), 'ContainerSpec')) ?? {};
	const draft = emptyDraft();
	draft.name = swarmString(object.Name) ?? '';
	draft.image = swarmString(containerSpec.Image) ?? '';

	const modeObject = swarmObject(object.Mode) ?? {};
	if (modeObject.Replicated !== undefined) {
		draft.mode = 'replicated';
		const count = swarmField(modeObject.Replicated, 'Replicas');
		if (typeof count === 'number' && Number.isFinite(count)) draft.replicas = Math.trunc(count);
	} else if (modeObject.Global !== undefined) {
		draft.mode = 'global';
	} else if (modeObject.ReplicatedJob !== undefined || modeObject.GlobalJob !== undefined) {
		draft.mode = 'job';
	}

	draft.ports = (swarmArray(swarmField(object.EndpointSpec, 'Ports')) ?? []).map((port) => ({
		id: uuid(),
		target: numberString(swarmField(port, 'TargetPort')),
		published: numberString(swarmField(port, 'PublishedPort')),
		proto: swarmString(swarmField(port, 'Protocol')) ?? 'tcp'
	}));
	draft.env = (swarmArray(containerSpec.Env) ?? [])
		.map(swarmString)
		.filter((v): v is string => v !== undefined)
		.map((entry) => {
			const index = entry.indexOf('=');
			return {
				id: uuid(),
				key: index < 0 ? entry : entry.slice(0, index),
				value: index < 0 ? '' : entry.slice(index + 1)
			};
		});
	draft.mounts = (swarmArray(containerSpec.Mounts) ?? []).map((mount) => {
		const readOnly = swarmField(mount, 'ReadOnly');
		return {
			id: uuid(),
			type: swarmString(swarmField(mount, 'Type')) ?? 'volume',
			source: swarmString(swarmField(mount, 'Source')) ?? '',
			target: swarmString(swarmField(mount, 'Target')) ?? '',
			readOnly: typeof readOnly === 'boolean' ? readOnly : false
		};
	});
	const labels = swarmObject(object.Labels) ?? {};
	draft.labels = Object.keys(labels)
		.sort()
		.map((key) => ({ id: uuid(), key, value: swarmString(labels[key]) ?? '' }));
	draft.command = joinArguments(containerSpec.Command);
	draft.args = joinArguments(containerSpec.Args);
	draft.workingDir = swarmString(containerSpec.Dir) ?? '';
	draft.user = swarmString(containerSpec.User) ?? '';
	draft.hostname = swarmString(containerSpec.Hostname) ?? '';
	return draft;
}

export const draftIsValid = (draft: SwarmServiceSpecDraft) =>
	trimmed(draft.name) !== '' && trimmed(draft.image) !== '';

/** Equality ignoring row identities (Swift compares UUIDs too, but drafts are only ever compared to their own origin). */
export function draftsEqual(a: SwarmServiceSpecDraft, b: SwarmServiceSpecDraft) {
	return JSON.stringify(a) === JSON.stringify(b);
}

function set(object: JSONObject, key: string, value: JSONValue | undefined) {
	if (value === undefined) delete object[key];
	else object[key] = value;
}

const optionalString = (value: string): JSONValue | undefined =>
	trimmed(value) === '' ? undefined : trimmed(value);

function objectFromPairs(pairs: DraftPair[]): JSONValue {
	const result: JSONObject = {};
	for (const pair of pairs) {
		if (trimmed(pair.key) === '') continue;
		result[trimmed(pair.key)] = pair.value;
	}
	return result;
}

const arrayValue = (strings: string[]): JSONValue | undefined =>
	strings.length === 0 ? undefined : strings;

/** `UInt32(string)`. */
function uint32(value: string): number | undefined {
	if (!/^\+?\d+$/.test(value)) return undefined;
	const parsed = Number(value);
	return parsed <= 0xffffffff ? parsed : undefined;
}

/** Writes the draft onto `original` (or a fresh spec), keeping unknown keys. */
export function applyDraft(
	draft: SwarmServiceSpecDraft,
	original: JSONValue | undefined
): JSONValue {
	const object: JSONObject = { ...swarmObject(original) };
	object.Name = trimmed(draft.name);
	object.Labels = objectFromPairs(draft.labels);

	const taskTemplate: JSONObject = { ...swarmObject(object.TaskTemplate) };
	const containerSpec: JSONObject = { ...swarmObject(taskTemplate.ContainerSpec) };
	containerSpec.Image = trimmed(draft.image);
	set(containerSpec, 'Command', arrayValue(splitArguments(draft.command)));
	set(containerSpec, 'Args', arrayValue(splitArguments(draft.args)));
	const envEntries = draft.env
		.filter((pair) => trimmed(pair.key) !== '')
		.map((pair) => `${trimmed(pair.key)}=${pair.value}`);
	set(containerSpec, 'Env', arrayValue(envEntries));
	set(containerSpec, 'Dir', optionalString(draft.workingDir));
	set(containerSpec, 'User', optionalString(draft.user));
	set(containerSpec, 'Hostname', optionalString(draft.hostname));

	const originalMounts = swarmArray(containerSpec.Mounts) ?? [];
	const mountValues: JSONValue[] = draft.mounts
		.filter((mount) => trimmed(mount.target) !== '')
		.map((mount) => {
			const target = trimmed(mount.target);
			const entry: JSONObject = {
				...swarmObject(originalMounts.find((m) => swarmString(swarmField(m, 'Target')) === target))
			};
			entry.Type = mount.type;
			entry.Source = trimmed(mount.source);
			entry.Target = target;
			entry.ReadOnly = mount.readOnly;
			return entry;
		});
	set(containerSpec, 'Mounts', mountValues.length === 0 ? undefined : mountValues);
	taskTemplate.ContainerSpec = containerSpec;
	object.TaskTemplate = taskTemplate;

	switch (draft.mode) {
		case 'replicated':
			object.Mode = { Replicated: { Replicas: Math.max(0, draft.replicas) } };
			break;
		case 'global':
			object.Mode = { Global: {} };
			break;
		case 'job':
			break;
	}

	const endpoint: JSONObject = { ...swarmObject(object.EndpointSpec) };
	const originalPorts = swarmArray(endpoint.Ports) ?? [];
	const portValues: JSONValue[] = [];
	for (const port of draft.ports) {
		const target = uint32(trimmed(port.target));
		if (target === undefined) continue;
		const match = originalPorts.find(
			(p) =>
				numberString(swarmField(p, 'TargetPort')) === String(target) &&
				(swarmString(swarmField(p, 'Protocol')) ?? 'tcp') === port.proto
		);
		const entry: JSONObject = { ...swarmObject(match) };
		entry.Protocol = port.proto;
		entry.TargetPort = target;
		const published = uint32(trimmed(port.published));
		if (published !== undefined) entry.PublishedPort = published;
		else delete entry.PublishedPort;
		portValues.push(entry);
	}
	set(endpoint, 'Ports', portValues.length === 0 ? undefined : portValues);
	object.EndpointSpec = endpoint;
	return object;
}
