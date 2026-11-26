import { create } from 'zustand';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { PodmanStatus } from '@/sdk/models/podman/PodmanStatus';

type PodmanStatusState = {
	statuses: Readonly<Record<string, PodmanStatus>>;
	detectedEnvironmentIDs: ReadonlySet<string>;
	setStatus: (envID: EnvironmentID, status: PodmanStatus | undefined) => void;
	reset: () => void;
};

const empty: ReadonlySet<string> = new Set();

export function detectedIDs(statuses: Readonly<Record<string, PodmanStatus>>): ReadonlySet<string> {
	const ids = Object.entries(statuses)
		.filter(([, status]) => status.detected)
		.map(([id]) => id);
	return ids.length === 0 ? empty : new Set(ids);
}

function sameStatus(a: PodmanStatus | undefined, b: PodmanStatus | undefined): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

function sameIDs(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
	return a.size === b.size && [...a].every((id) => b.has(id));
}

export const usePodmanStatusStore = create<PodmanStatusState>((set, get) => ({
	statuses: {},
	detectedEnvironmentIDs: empty,
	setStatus: (envID, status) => {
		const current = get().statuses;
		if (sameStatus(current[envID], status)) return;
		const next = { ...current };
		if (status) next[envID] = status;
		else delete next[envID];
		const ids = detectedIDs(next);
		set({
			statuses: next,
			detectedEnvironmentIDs: sameIDs(ids, get().detectedEnvironmentIDs)
				? get().detectedEnvironmentIDs
				: ids
		});
	},
	reset: () => {
		if (Object.keys(get().statuses).length === 0) return;
		set({ statuses: {}, detectedEnvironmentIDs: empty });
	}
}));

export function usePodmanStatus(envID: EnvironmentID): PodmanStatus | undefined {
	return usePodmanStatusStore((s) => s.statuses[envID]);
}
