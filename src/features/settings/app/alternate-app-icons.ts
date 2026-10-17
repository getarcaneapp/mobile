/**
 * App icon options for `AppIconPickerView` (AppIconPickerView.swift).
 *
 * Swift reads `CFBundleAlternateIcons` and `UIApplication.alternateIconName`
 * synchronously. UIKit only allows those on the main thread, so the native
 * module answers asynchronously and this store caches the answer: it loads at
 * import (long before Settings opens) and updates after every change.
 */
import { useSyncExternalStore } from 'react';

import { ArcaneAppIcon } from '../../../../modules/arcane-app-icon';

export type AppIconOption = {
	/** `undefined` represents the primary / default icon. */
	alternateName: string | undefined;
	displayName: string;
	/** `AppIconPreviewAsset.name(for:)` as a bundled asset module (`require`); undefined when missing. */
	preview: number | undefined;
};

/** Thumbnails exported from the reference app's `<alternateName ?? "AppIcon">-Preview-HighContrast` image sets. */
const previews: Record<string, number> = {
	AppIcon: require('@/assets/app-icons/previews/AppIcon.png'),
	'AppIcon-Blueprint': require('@/assets/app-icons/previews/AppIcon-Blueprint.png'),
	'AppIcon-Development-Preview': require('@/assets/app-icons/previews/AppIcon-Development-Preview.png'),
	'AppIcon-Ember': require('@/assets/app-icons/previews/AppIcon-Ember.png'),
	'AppIcon-Hologram': require('@/assets/app-icons/previews/AppIcon-Hologram.png'),
	'AppIcon-Liquid-Glass-Dark': require('@/assets/app-icons/previews/AppIcon-Liquid-Glass-Dark.png'),
	'AppIcon-Liquid-Glass-Light': require('@/assets/app-icons/previews/AppIcon-Liquid-Glass-Light.png'),
	'AppIcon-Porcelain': require('@/assets/app-icons/previews/AppIcon-Porcelain.png'),
	'AppIcon-Techy-Arcane': require('@/assets/app-icons/previews/AppIcon-Techy-Arcane.png'),
	'AppIcon-Terminal': require('@/assets/app-icons/previews/AppIcon-Terminal.png')
};

/** `UIImage(named:)` returns nil for a missing preview: the row shows a placeholder. */
function previewFor(name: string | undefined): number | undefined {
	return previews[name ?? 'AppIcon'];
}

function prettify(raw: string): string {
	if (raw === 'AppIcon-Techy-Arcane') return 'Techy';
	if (raw === 'AppIcon-Development-Preview') return 'Blueprint';
	if (raw === 'AppIcon-Blueprint') return 'Wireframe';
	return raw.replaceAll('AppIcon-', '').replaceAll('_', ' ').replaceAll('-', ' ');
}

type IconState = {
	supportsAlternateIcons: boolean;
	currentIconName: string | undefined;
};

let state: IconState = {
	supportsAlternateIcons: false,
	currentIconName: undefined
};
const listeners = new Set<() => void>();

function update(next: Partial<IconState>) {
	state = { ...state, ...next };
	for (const listener of listeners) listener();
}

async function refresh() {
	try {
		const [supportsAlternateIcons, currentIconName] = await Promise.all([
			ArcaneAppIcon.supportsAlternateIcons(),
			ArcaneAppIcon.getAlternateIconName()
		]);
		update({ supportsAlternateIcons, currentIconName });
	} catch {
		// Leave the section hidden, as Swift does when icons aren't supported.
	}
}

void refresh();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** `supportsAlternateIcons` and `alternateIconName`, re-rendering on change. */
export function useAppIconState(): IconState {
	return useSyncExternalStore(subscribe, () => state);
}

export const AlternateAppIcons = {
	/** The primary icon followed by each alternate in `CFBundleAlternateIcons`, sorted by name. */
	options: [
		{
			alternateName: undefined,
			displayName: 'Default',
			preview: previewFor(undefined)
		},
		...[...ArcaneAppIcon.alternateIconNames].sort().map((name) => ({
			alternateName: name,
			displayName: prettify(name),
			preview: previewFor(name)
		}))
	] as AppIconOption[],
	/** `UIApplication.shared.setAlternateIconName(_:)`. */
	async setAlternateIconName(name: string | undefined): Promise<void> {
		await ArcaneAppIcon.setAlternateIconName(name);
		update({ currentIconName: name });
	},
	/** Re-read from the system (the Android launcher state can change underneath the app). */
	refresh,
	previewFor
};
