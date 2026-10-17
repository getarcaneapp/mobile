/**
 * Port of `ResourceMutationStore.swift`: per-kind/per-environment change
 * counters so a list reloads after a mutation made elsewhere.
 */
import { create } from 'zustand';

import type { EnvironmentID } from '@/sdk/client/environment';

export type ResourceKind =
	| 'containers'
	| 'images'
	| 'projects'
	| 'volumes'
	| 'networks'
	| 'environments'
	| 'swarm';

const versionKey = (kind: ResourceKind, envID?: EnvironmentID) => `${kind}::${envID ?? '_global_'}`;

type ResourceMutationState = {
	versions: Readonly<Record<string, number>>;
	version: (kind: ResourceKind, envID?: EnvironmentID) => number;
	markChanged: (kind: ResourceKind, envID?: EnvironmentID) => void;
};

export const useResourceMutationStore = create<ResourceMutationState>((set, get) => ({
	versions: {},
	version: (kind, envID) => get().versions[versionKey(kind, envID)] ?? 0,
	markChanged: (kind, envID) => {
		const key = versionKey(kind, envID);
		set((s) => ({ versions: { ...s.versions, [key]: (s.versions[key] ?? 0) + 1 } }));
	}
}));

/** Reactive version for one kind/environment. */
export function useResourceVersion(kind: ResourceKind, envID?: EnvironmentID): number {
	return useResourceMutationStore((s) => s.versions[versionKey(kind, envID)] ?? 0);
}

/** Sum over `environments`, so an All Environments list reloads after a mutation in any of them. */
export function useResourceVersionIn(
	kind: ResourceKind,
	environments: readonly { id: EnvironmentID }[]
): number {
	return useResourceMutationStore((s) =>
		environments.reduce(
			(total, environment) => total + (s.versions[versionKey(kind, environment.id)] ?? 0),
			0
		)
	);
}
