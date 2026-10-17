/**
 * Port of `EnvironmentColorStore.swift`: a distinct color per environment,
 * per server, persisted under `arcane.environmentColors`.
 */
import { create } from 'zustand';

import { ConnectionProfileSync } from '@/core/connection-profiles/connection-profile-sync';
import { storage } from '@/core/storage';

const colorsKey = 'arcane.environmentColors';

const palette = [
	'#2680C2',
	'#D06820',
	'#289B66',
	'#9657CA',
	'#C64574',
	'#168D97',
	'#AB841A',
	'#646DD6',
	'#BB5142',
	'#678B36',
	'#A453A5',
	'#477D91'
];

function loadColors(): Record<string, string> {
	const raw = storage.json<unknown>(colorsKey);
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
	return Object.fromEntries(
		Object.entries(raw as Record<string, unknown>).filter(
			(entry): entry is [string, string] => typeof entry[1] === 'string'
		)
	);
}

/** Rows look colors up per render; normalize each server URL once. */
const normalizedServers = new Map<string, string>();

function key(server: string, environmentID: string): string {
	let normalized = normalizedServers.get(server);
	if (normalized === undefined) {
		try {
			normalized = ConnectionProfileSync.normalizedServerURL(server);
		} catch {
			normalized = server;
		}
		normalizedServers.set(server, normalized);
	}
	return normalized + '\n' + environmentID;
}

function availableColor(used: ReadonlySet<string>): string {
	const color = palette.find((candidate) => !used.has(candidate));
	if (color) return color;
	// Walk the RGB space without repeating colors once the palette is exhausted.
	for (let index = 1; index <= 0xffffff; index++) {
		const value = (index * 0x9e3779) % 0x1000000; // exact: the product stays below 2^53
		const candidate = '#' + value.toString(16).toUpperCase().padStart(6, '0');
		if (!used.has(candidate)) return candidate;
	}
	throw new Error('Environment color space exhausted');
}

type EnvironmentColorState = {
	colors: Readonly<Record<string, string>>;
	hex: (server: string, environmentID: string) => string | undefined;
	assignDefaults: (server: string, environmentIDs: readonly string[]) => void;
	isAvailable: (hex: string, server: string, environmentID: string) => boolean;
	set: (hex: string | undefined, server: string, environmentID: string) => boolean;
};

export const useEnvironmentColorStore = create<EnvironmentColorState>((setState, get) => ({
	colors: loadColors(),

	hex: (server, environmentID) => get().colors[key(server, environmentID)],

	assignDefaults: (server, environmentIDs) => {
		const colors = get().colors;
		const prefix = key(server, '');
		const used = new Set<string>();
		// Include saved environments that are temporarily absent, so their colors stay reserved.
		const keys = new Set([
			...Object.keys(colors).filter((k) => k.startsWith(prefix)),
			...environmentIDs.map((id) => key(server, id))
		]);
		const next: Record<string, string> = { ...colors };
		for (const k of [...keys].sort()) {
			const existing = next[k]?.toUpperCase();
			if (existing !== undefined && !used.has(existing)) {
				used.add(existing);
				next[k] = existing;
			} else {
				const color = availableColor(used);
				next[k] = color;
				used.add(color);
			}
		}
		// Only publish (and re-render every colored row) when something changed.
		const changed =
			Object.keys(next).length !== Object.keys(colors).length ||
			Object.entries(next).some(([k, v]) => colors[k] !== v);
		if (!changed) return;
		setState({ colors: next });
		storage.setJSON(colorsKey, next);
	},

	isAvailable: (hex, server, environmentID) => {
		const target = key(server, environmentID);
		const prefix = key(server, '');
		return !Object.entries(get().colors).some(
			([k, v]) => k.startsWith(prefix) && k !== target && v.toUpperCase() === hex.toUpperCase()
		);
	},

	set: (hex, server, environmentID) => {
		const target = key(server, environmentID);
		const prefix = key(server, '');
		const colors = get().colors;
		const used = new Set(
			Object.entries(colors)
				.filter(([k]) => k.startsWith(prefix) && k !== target)
				.map(([, v]) => v.toUpperCase())
		);
		const value = hex?.toUpperCase() ?? availableColor(used);
		if (used.has(value)) return false;
		const next = { ...colors, [target]: value };
		setState({ colors: next });
		storage.setJSON(colorsKey, next);
		return true;
	}
}));
