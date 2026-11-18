import { Appearance } from 'react-native';

import { Keys, storage, useStoredString } from '@/core/storage';

export type ColorSchemeMode = 'system' | 'light' | 'dark';

export const ColorSchemeOptions: readonly { value: ColorSchemeMode; title: string }[] = [
	{ value: 'system', title: 'System' },
	{ value: 'light', title: 'Light' },
	{ value: 'dark', title: 'Dark' }
];

export function colorSchemeModeFrom(raw: string | undefined): ColorSchemeMode {
	return raw === 'light' || raw === 'dark' ? raw : 'system';
}

function applyColorSchemeMode(mode: ColorSchemeMode): void {
	Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

export function applyStoredColorScheme(): void {
	const mode = colorSchemeModeFrom(storage.string(Keys.colorScheme));
	if (mode !== 'system') applyColorSchemeMode(mode);
}

export function useColorSchemeMode(): [ColorSchemeMode, (mode: ColorSchemeMode) => void] {
	const [raw, setRaw] = useStoredString(Keys.colorScheme, 'system');
	return [
		colorSchemeModeFrom(raw),
		(mode) => {
			setRaw(mode);
			applyColorSchemeMode(mode);
		}
	];
}
