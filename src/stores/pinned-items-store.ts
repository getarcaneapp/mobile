import { create } from 'zustand';

import { storage } from '@/core/storage';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';

export type PinnedItemKind = 'container' | 'project' | 'volume';

const legacyStorageKey = (kind: PinnedItemKind, envID: EnvironmentID) =>
	`arcane.pinned.${kind}.${envID}`;

const storageKey = (kind: PinnedItemKind, envID: EnvironmentID) => {
	const origin = useClientManager.getState().serverOrigin() ?? '';
	return `arcane.pinnedByServer.${origin}.${kind}.${envID}`;
};

function parseIDs(value: unknown): Set<string> {
	return new Set(
		Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
	);
}

function loadFromDefaults(kind: PinnedItemKind, envID: EnvironmentID): Set<string> {
	const key = storageKey(kind, envID);
	const stored = storage.json<unknown>(key);
	if (stored !== undefined) return parseIDs(stored);
	const legacyKey = legacyStorageKey(kind, envID);
	const legacy = storage.json<unknown>(legacyKey);
	if (legacy === undefined) return new Set();
	const ids = parseIDs(legacy);
	if (ids.size > 0) storage.setJSON(key, [...ids]);
	storage.remove(legacyKey);
	return ids;
}

type PinnedItemsState = {
	version: number;
	pinnedIDs: (kind: PinnedItemKind, envID: EnvironmentID) => ReadonlySet<string>;
	isPinned: (id: string, kind: PinnedItemKind, envID: EnvironmentID) => boolean;
	togglePin: (id: string, kind: PinnedItemKind, envID: EnvironmentID) => void;
};

const cache = new Map<string, Set<string>>();

export const usePinnedItemsStore = create<PinnedItemsState>((set, get) => ({
	version: 0,
	pinnedIDs: (kind, envID) => {
		const key = storageKey(kind, envID);
		let ids = cache.get(key);
		if (!ids) {
			ids = loadFromDefaults(kind, envID);
			cache.set(key, ids);
		}
		return ids;
	},
	isPinned: (id, kind, envID) => get().pinnedIDs(kind, envID).has(id),
	togglePin: (id, kind, envID) => {
		const key = storageKey(kind, envID);
		const current = new Set(cache.get(key) ?? loadFromDefaults(kind, envID));
		if (current.has(id)) current.delete(id);
		else current.add(id);
		if (current.size === 0) storage.remove(key);
		else storage.setJSON(key, [...current]);
		cache.set(key, current);
		set((s) => ({ version: s.version + 1 }));
	}
}));

useClientManager.subscribe((state, previous) => {
	if (state.parsedServerURL === previous.parsedServerURL) return;
	usePinnedItemsStore.setState((s) => ({ version: s.version + 1 }));
});

export function usePinnedIDs(kind: PinnedItemKind, envID: EnvironmentID): ReadonlySet<string> {
	usePinnedItemsStore((s) => s.version);
	return usePinnedItemsStore((s) => s.pinnedIDs(kind, envID));
}
