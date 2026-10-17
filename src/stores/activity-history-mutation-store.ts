/** Port of `ActivityHistoryMutationStore.swift`. */
import { create } from 'zustand';

export type ActivityHistoryClearEvent = {
	sequence: number;
	environmentIDs: ReadonlySet<string>;
};

type ActivityHistoryMutationState = {
	latestClear: ActivityHistoryClearEvent | undefined;
	recordClear: (environmentIDs: ReadonlySet<string>) => void;
};

let sequence = 0;

export const useActivityHistoryMutationStore = create<ActivityHistoryMutationState>((set) => ({
	latestClear: undefined,
	recordClear: (environmentIDs) => {
		if (environmentIDs.size === 0) return;
		sequence += 1;
		set({ latestClear: { sequence, environmentIDs } });
	}
}));
