/**
 * Ports of `BackupRequestScope` (Types/BackupRequestScope.swift) and the
 * `BackupSessionScope` view modifier (BackupSessionScope.swift), plus the
 * global-permission checks every backup screen uses
 * (`manager.permissions.has(..., in: nil)`).
 */
import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { CancellationError } from '@/sdk/errors/ArcaneError';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';

/**
 * Captures the client generation and environment when a request starts;
 * `check()` throws `CancellationError` once either changed (or the screen is
 * gone, Swift `Task.checkCancellation()`).
 */
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

/** `false` once the component unmounted (Swift task cancellation on disappear). */
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

/** `.modifier(BackupSessionScope())`: dismiss when the client or active environment changes. */
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

/** `manager.permissions.has(perm, in: nil)`, re-evaluated when access changes. */
export function useGlobalPermissions() {
	useClientManager((s) => s.accessGeneration);
	useClientManager((s) => s.activeEnvironmentID);
	const user = useClientManager((s) => s.currentUser);
	return {
		has: (perm: string) => hasPermission(perm, null),
		/** `manager.permissions.has(perm, in: EnvironmentID(rawValue: "0"))`. */
		hasInLocal: (perm: string) => hasPermission(perm, '0'),
		isAdmin: user ? User.isAdmin(user) : false,
		isGlobalAdmin: user ? User.isGlobalAdmin(user) : false
	};
}

/** Swift `.sheet(onDismiss:)` hand-back: sheets announce their dismissal to the presenting list. */
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

/** Emits `channel` when the calling sheet screen goes away. */
export function useEmitOnDismiss(channel: 'history' | 's3', enabled = true) {
	useEffect(() => {
		if (!enabled) return;
		return () => backupEvents.emit(channel);
	}, [channel, enabled]);
}

/** Runs `onDismiss` whenever a sheet on `channel` was dismissed. */
export function useSheetDismissListener(channel: 'history' | 's3', onDismiss: () => void) {
	const latest = useRef(onDismiss);
	latest.current = onDismiss;
	useEffect(() => backupEvents.subscribe(channel, () => latest.current()), [channel]);
}
