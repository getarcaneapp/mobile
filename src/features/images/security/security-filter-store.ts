/**
 * AllVulnerabilitiesView's Findings filter `@State`, keyed per list instance
 * so the Filters sheet (a separate route here) edits the list that opened it.
 * The sheet's Done bumps `doneRevision`; the list reloads on that.
 */
import { create } from 'zustand';

import type { ListEnvironment } from '@/stores/environments-store';

import type { VulnerabilitySeverity } from './vulnerability-model';

export type SecurityFilterState = {
	selectedSeverities: VulnerabilitySeverity[];
	selectedImage?: string;
	onlyFixAvailable: boolean;
	environmentFilter?: string;
	/** The list's environments, for the Environment filter section. */
	environments: ListEnvironment[];
	/** Image names for the Image picker. */
	imageOptions: string[];
	/** Bumped by the sheet's Done button. */
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

/** Current values, read synchronously (Swift reads `@State` live inside tasks). */
export function securityFilterSnapshot(key: string): SecurityFilterState {
	return useSecurityFilterStore.getState().lists[key] ?? defaultSecurityFilter;
}

/** Filters-sheet actions shared by both platforms. */
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
