import { useNavigationContainerRef } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Appearance, Platform } from 'react-native';

type RootState = ReturnType<ReturnType<typeof useNavigationContainerRef>['getRootState']>;

type NestedState = { routes: { name: string; params?: object; state?: unknown }[]; index?: number };
type SheetRoute = { name: string; params?: object };

const baseRoutes = new Set(['index', '(tabs)', 'login']);

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
