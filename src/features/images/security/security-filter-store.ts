import { create } from 'zustand';

import type { ListEnvironment } from '@/stores/environments-store';

import type { VulnerabilitySeverity } from './vulnerability-model';

export type SecurityFilterState = {
	selectedSeverities: VulnerabilitySeverity[];
	selectedImage?: string;
	onlyFixAvailable: boolean;
	environmentFilter?: string;
	environments: ListEnvironment[];
	imageOptions: string[];
	doneRevision: number;
};

export const defaultSecurityFilter: SecurityFilterState = {
	selectedSeverities: [],
	onlyFixAvailable: false,
	environments: [],
	imageOptions: [],
	doneRevision: 0
};

type Store = {
	lists: Record<string, SecurityFilterState>;
	update: (key: string, patch: Partial<SecurityFilterState>) => void;
	remove: (key: string) => void;
};

export const useSecurityFilterStore = create<Store>((set) => ({
	lists: {},
	update: (key, patch) =>
		set((s) => ({
			lists: { ...s.lists, [key]: { ...(s.lists[key] ?? defaultSecurityFilter), ...patch } }
		})),
	remove: (key) =>
		set((s) => {
			const { [key]: _removed, ...rest } = s.lists;
			return { lists: rest };
		})
}));

export function useSecurityFilter(key: string): SecurityFilterState {
	return useSecurityFilterStore((s) => s.lists[key] ?? defaultSecurityFilter);
}

export function securityFilterSnapshot(key: string): SecurityFilterState {
	return useSecurityFilterStore.getState().lists[key] ?? defaultSecurityFilter;
}

export function securityFilterActions(key: string) {
	const update = (patch: Partial<SecurityFilterState>) =>
		useSecurityFilterStore.getState().update(key, patch);
	return {
		update,
		toggleSeverity(this: void, severity: VulnerabilitySeverity, isOn: boolean) {
			const current = securityFilterSnapshot(key).selectedSeverities;
			update({
				selectedSeverities: isOn
					? [...current.filter((s) => s !== severity), severity]
					: current.filter((s) => s !== severity)
			});
		},
		reset(this: void) {
			update({
				selectedSeverities: [],
				selectedImage: undefined,
				onlyFixAvailable: false,
				environmentFilter: undefined
			});
		},
		done(this: void) {
			update({ doneRevision: securityFilterSnapshot(key).doneRevision + 1 });
		}
	};
}
