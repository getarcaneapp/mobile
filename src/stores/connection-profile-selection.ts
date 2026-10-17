/**
 * Carries `ConnectionProfilesView`'s `onSelect` closure across the sheet
 * route: the presenter registers a handler, the sheet calls it on selection.
 */
import { create } from 'zustand';

import type { ConnectionProfile } from '@/core/connection-profiles/connection-profile-sync';

type SelectionState = {
	onSelect: ((profile: ConnectionProfile) => void) | undefined;
	begin: (handler: (profile: ConnectionProfile) => void) => void;
	end: () => void;
};

export const useConnectionProfileSelection = create<SelectionState>((set) => ({
	onSelect: undefined,
	begin: (handler) => set({ onSelect: handler }),
	end: () => set({ onSelect: undefined })
}));
