import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentColorStore } from '@/stores/environment-color-store';

export function useDebounced<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);
	return debounced;
}

export function useOnChange<T>(value: T, effect: (value: T, previous: T) => void) {
	const previous = useRef(value);
	const latest = useRef(effect);
	latest.current = effect;
	useEffect(() => {
		if (Object.is(previous.current, value)) return;
		const old = previous.current;
		previous.current = value;
		latest.current(value, old);
	}, [value]);
}

export function useAppIsActive(): boolean {
	const [active, setActive] = useState(AppState.currentState === 'active');
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) =>
			setActive(state === 'active')
		);
		return () => subscription.remove();
	}, []);
	return active;
}

export function useIsScreenFocused(): boolean {
	const [focused, setFocused] = useState(false);
	useFocusEffect(
		useCallback(() => {
			setFocused(true);
			return () => setFocused(false);
		}, [])
	);
	return focused;
}

export function useEnvironmentRowColor(
	environmentID: string,
	environmentName: string | undefined
): string | undefined {
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	const server = useClientManager((s) => s.serverURL);
	const hex = useEnvironmentColorStore((s) => s.colors);
	if (!allEnvironments || environmentName === undefined) return undefined;
	void hex;
	return useEnvironmentColorStore.getState().hex(server, environmentID);
}
