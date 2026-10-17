import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { routePayloads } from './volume-routes';
import type { BackupCreateState, BackupCreateStore } from './use-volume-backups';
import { useBackupSessionScope, useUnmounted } from './volume-support';

const emptyState: BackupCreateState = {
	destination: 'local',
	s3ID: '',
	supportsPolicies: false,
	destinations: [],
	setDestination: () => {},
	setS3ID: () => {},
	create: async () => false
};

export function useBackupCreate(token: string | undefined) {
	const router = useRouter();
	useBackupSessionScope();
	const unmounted = useUnmounted();
	const storeRef = useRef<BackupCreateStore | undefined>(
		routePayloads.get<BackupCreateStore>(token)
	);
	const fallback = useRef<BackupCreateStore | undefined>(undefined);
	const store = storeRef.current;
	const state = useStore(store ?? (fallback.current ??= makeEmpty()));
	if (!store) return undefined;
	return {
		state,
		canCreate: !(state.destination !== 'local' && state.s3ID === ''),
		create: () => {
			void state.create().then((created) => {
				if (created && !unmounted.current) router.back();
			});
		}
	};
}

function makeEmpty(): BackupCreateStore {
	return createStore<BackupCreateState>(() => emptyState);
}
