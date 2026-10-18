import { useNavigation } from 'expo-router';
import { useEffect, useEffectEvent, useRef } from 'react';

import { usePermissionCheck } from '@/core/auth/permissions';
import { CancellationError } from '@/sdk/errors/ArcaneError';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';

export function backupRequestScope(isAlive: () => boolean = () => true) {
	const start = useClientManager.getState();
	const generation = start.clientGeneration;
	const environmentID = start.activeEnvironmentID;
	return {
		check() {
			const now = useClientManager.getState();
			if (
				!isAlive() ||
				now.clientGeneration !== generation ||
				now.activeEnvironmentID !== environmentID
			) {
				throw new CancellationError();
			}
		}
	};
}

export function useAliveRef() {
	const alive = useRef(true);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	return alive;
}

export function useBackupSessionScope() {
	const navigation = useNavigation();
	const generation = useClientManager((s) => s.clientGeneration);
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const initial = useRef({ generation, environmentID });
	useEffect(() => {
		if (
			initial.current.generation === generation &&
			initial.current.environmentID === environmentID
		)
			return;
		initial.current = { generation, environmentID };
		if (navigation.canGoBack()) navigation.goBack();
	}, [generation, environmentID, navigation]);
}

export function useGlobalPermissions() {
	const can = usePermissionCheck();
	const user = useClientManager((s) => s.currentUser);
	return {
		has: (perm: string) => can(perm, null),
		hasInLocal: (perm: string) => can(perm, '0'),
		isAdmin: user ? User.isAdmin(user) : false,
		isGlobalAdmin: user ? User.isGlobalAdmin(user) : false
	};
}

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export const backupEvents = {
	emit(channel: 'history' | 's3') {
		listeners.get(channel)?.forEach((listener) => listener());
	},
	subscribe(channel: 'history' | 's3', listener: Listener) {
		const set = listeners.get(channel) ?? new Set<Listener>();
		set.add(listener);
		listeners.set(channel, set);
		return () => {
			set.delete(listener);
		};
	}
};

export function useEmitOnDismiss(channel: 'history' | 's3', enabled = true) {
	useEffect(() => {
		if (!enabled) return;
		return () => backupEvents.emit(channel);
	}, [channel, enabled]);
}

export function useSheetDismissListener(channel: 'history' | 's3', onDismiss: () => void) {
	const handleDismiss = useEffectEvent(onDismiss);
	useEffect(() => backupEvents.subscribe(channel, () => handleDismiss()), [channel]);
}
