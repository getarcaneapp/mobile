import { useNavigationContainerRef } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Appearance, Platform } from 'react-native';

type RootState = ReturnType<ReturnType<typeof useNavigationContainerRef>['getRootState']>;

type NestedState = { routes: { name: string; params?: object; state?: unknown }[]; index?: number };
type SheetRoute = { name: string; params?: object };

/** Root stack screens that aren't sheets (src/app/_layout.tsx). */
const baseRoutes = new Set(['index', '(tabs)', 'login']);

/**
 * Splits the root layout's stack (under expo-router's `__root`) into the
 * state without its sheets, and the sheets that were presented on top.
 */
function withoutRootSheets<T extends NestedState>(state: T): { state: T; sheets: SheetRoute[] } {
	if (state.routes.some((route) => baseRoutes.has(route.name))) {
		const routes = state.routes.filter((route) => baseRoutes.has(route.name));
		if (routes.length === 0 || routes.length === state.routes.length) return { state, sheets: [] };
		const sheets = state.routes.filter((route) => !baseRoutes.has(route.name));
		return { state: { ...state, routes, index: routes.length - 1 }, sheets };
	}
	const focused = state.routes[state.index ?? 0];
	if (!focused?.state) return { state, sheets: [] };
	const inner = withoutRootSheets(focused.state as NestedState);
	const routes = state.routes.map((route) =>
		route === focused ? { ...route, state: inner.state } : route
	);
	return { state: { ...state, routes }, sheets: inner.sheets };
}

/**
 * Android: live dark-mode switching.
 *
 * MainActivity handles `uiMode` itself (no activity restart), and Material 3
 * dynamic colors resolve to per-scheme hex values (`appearanceColors`), so
 * views only pick up a new appearance when they render again. On a scheme
 * change this returns a new key for the app tree so every screen re-renders
 * with the new colors, and restores the navigation state (tabs, stacks,
 * modals) once the navigators have mounted again, re-presenting root sheets. Screen-local
 * state (scroll position, unsaved fields) starts over, as it would after an
 * activity restart. iOS colors are dynamic natively, so the key never changes.
 */
export function useAppearanceRemountKey(): number {
	const navigationRef = useNavigationContainerRef();
	const [epoch, setEpoch] = useState(0);
	const pendingState = useRef<RootState | undefined>(undefined);

	useEffect(() => {
		if (Platform.OS !== 'android') return;
		let scheme = Appearance.getColorScheme();
		const subscription = Appearance.addChangeListener(({ colorScheme }) => {
			if (colorScheme === scheme) return;
			scheme = colorScheme;
			pendingState.current = navigationRef.isReady() ? navigationRef.getRootState() : undefined;
			setEpoch((value) => value + 1);
		});
		return () => subscription.remove();
	}, [navigationRef]);

	useEffect(() => {
		const state = pendingState.current;
		if (!state) return;
		pendingState.current = undefined;
		// A restored Android formSheet mounts below the screen edge, so restore
		// the screens underneath and present the root sheets again once the
		// remounted navigators have laid out.
		const { state: base, sheets } = withoutRootSheets(state);
		navigationRef.reset(base);
		if (sheets.length === 0) return;
		const timer = setTimeout(() => {
			for (const sheet of sheets) {
				(navigationRef.navigate as (name: string, params?: object) => void)(
					sheet.name,
					sheet.params
				);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [epoch, navigationRef]);

	return epoch;
}
