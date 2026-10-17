import { useSyncExternalStore } from 'react';
import { createMMKV } from 'react-native-mmkv';

export const defaults = createMMKV({ id: 'arcane.defaults' });

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

defaults.addOnValueChangedListener((key) => {
	listeners.get(key)?.forEach((listener) => listener());
});

function subscribe(key: string, listener: Listener): () => void {
	const set = listeners.get(key) ?? new Set<Listener>();
	set.add(listener);
	listeners.set(key, set);
	return () => {
		set.delete(listener);
	};
}

export const storage = {
	string: (key: string): string | undefined => defaults.getString(key),
	bool: (key: string): boolean | undefined => defaults.getBoolean(key),
	number: (key: string): number | undefined => defaults.getNumber(key),
	json<T>(key: string): T | undefined {
		const raw = defaults.getString(key);
		if (raw === undefined) return undefined;
		try {
			return JSON.parse(raw) as T;
		} catch {
			return undefined;
		}
	},
	set(key: string, value: string | number | boolean): void {
		defaults.set(key, value);
	},
	setJSON(key: string, value: unknown): void {
		defaults.set(key, JSON.stringify(value));
	},
	remove(key: string): void {
		defaults.remove(key);
	},
	has: (key: string): boolean => defaults.contains(key),
	subscribe
};

export function useStoredString(key: string, fallback: string): [string, (value: string) => void] {
	const value = useSyncExternalStore(
		(listener) => subscribe(key, listener),
		() => defaults.getString(key) ?? fallback
	);
	return [value, (next) => defaults.set(key, next)];
}

export function useStoredBool(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
	const value = useSyncExternalStore(
		(listener) => subscribe(key, listener),
		() => defaults.getBoolean(key) ?? fallback
	);
	return [value, (next) => defaults.set(key, next)];
}

export const Keys = {
	serverURL: 'arcane.serverURL',
	activeEnvironmentID: 'arcane.activeEnvironmentID',
	activeEnvironmentName: 'arcane.activeEnvironmentName',
	allEnvironmentsPreview: 'arcane.allEnvironmentsPreview',
	refreshedDashboardPreview: 'arcane.refreshedDashboardPreview',
	accentColorHex: 'accentColorHex',
	launchAnimationEnabled: 'arcane.launchAnimationEnabled',
	rememberLastTab: 'arcane.rememberLastTab',
	lastSelectedTabID: 'arcane.lastSelectedTabID',
	showTabLabels: 'arcane.showTabLabels',
	navBarTabs: 'arcane.navBarTabs'
} as const;
