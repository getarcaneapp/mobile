/**
 * `Stack.Toolbar` icons for both platforms. iOS takes SF Symbol names; the
 * Android toolbar only accepts image sources, so the mapped Material Symbol
 * is rendered to an image once and cached.
 */
import { unstable_getMaterialSymbolSourceAsync } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { materialSymbol } from './symbols';

const cache = new Map<string, ImageSourcePropType>();
const pending = new Map<string, Promise<void>>();

function load(sf: string): Promise<void> {
	const existing = pending.get(sf);
	if (existing) return existing;
	// The iOS declaration takes no size/color; this only runs on Android.
	const render = unstable_getMaterialSymbolSourceAsync as unknown as (
		symbol: string,
		size: number,
		color: string
	) => Promise<ImageSourcePropType | null>;
	const task = render(materialSymbol(sf), 24, '#000000')
		.then((source) => {
			if (source) cache.set(sf, source);
		})
		.catch(() => {});
	pending.set(sf, task);
	return task;
}

export type ToolbarIcon = SFSymbol | ImageSourcePropType;

/**
 * Resolves toolbar icons for the current platform. On Android an icon is
 * `undefined` until its image is ready (the item re-renders when it is).
 */
export function useToolbarIcons(names: readonly string[]): (sf: string) => ToolbarIcon | undefined {
	const [, setVersion] = useState(0);
	const key = names.join('|');
	useEffect(() => {
		if (Platform.OS !== 'android') return;
		let cancelled = false;
		const missing = key.split('|').filter((name) => name !== '' && !cache.has(name));
		if (missing.length === 0) return;
		void Promise.all(missing.map(load)).then(() => {
			if (!cancelled) setVersion((v) => v + 1);
		});
		return () => {
			cancelled = true;
		};
	}, [key]);
	return (sf) => (Platform.OS === 'android' ? cache.get(sf) : (sf as SFSymbol));
}

/**
 * Android's toolbar only draws icon buttons, so text actions (Done, Save…)
 * get an icon there while iOS keeps the text label: pass the result as `icon`.
 */
export function androidOnlyIcon(
	resolve: (sf: string) => ToolbarIcon | undefined,
	sf: string
): ToolbarIcon | undefined {
	return Platform.OS === 'android' ? resolve(sf) : undefined;
}
