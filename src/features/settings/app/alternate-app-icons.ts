import { useSyncExternalStore } from 'react';

import { ArcaneAppIcon } from '../../../../modules/arcane-app-icon';

export type AppIconOption = {
	alternateName: string | undefined;
	displayName: string;
	preview: number | undefined;
};

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
	} catch {}
}

void refresh();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export function useAppIconState(): IconState {
	return useSyncExternalStore(subscribe, () => state);
}

export const AlternateAppIcons = {
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
	async setAlternateIconName(name: string | undefined): Promise<void> {
		await ArcaneAppIcon.setAlternateIconName(name);
		update({ currentIconName: name });
	},
	refresh,
	previewFor
};
