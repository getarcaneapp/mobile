import { create } from 'zustand';

import { storage } from '@/core/storage';
import type { EnvironmentID } from '@/sdk/client/environment';

export type PinnedItemKind = 'container' | 'project' | 'volume';

const storageKey = (kind: PinnedItemKind, envID: EnvironmentID) => `arcane.pinned.${kind}.${envID}`;

function loadFromDefaults(key: string): Set<string> {
	const ids = storage.json<unknown>(key);
	return new Set(
		Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
	);
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
			ids = loadFromDefaults(key);
			cache.set(key, ids);
		}
		return ids;
	},
	isPinned: (id, kind, envID) => get().pinnedIDs(kind, envID).has(id),
	togglePin: (id, kind, envID) => {
		const key = storageKey(kind, envID);
		const current = new Set(cache.get(key) ?? loadFromDefaults(key));
		if (current.has(id)) current.delete(id);
		else current.add(id);
		if (current.size === 0) storage.remove(key);
		else storage.setJSON(key, [...current]);
		cache.set(key, current);
		set((s) => ({ version: s.version + 1 }));
	}
}));

export function usePinnedIDs(kind: PinnedItemKind, envID: EnvironmentID): ReadonlySet<string> {
	usePinnedItemsStore((s) => s.version);
	return usePinnedItemsStore.getState().pinnedIDs(kind, envID);
}
