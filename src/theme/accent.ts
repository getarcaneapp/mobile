import { Keys, useStoredString } from '@/core/storage';

import { parseHex } from './colors';

/** `AccentColorOption` from AppearanceSettingsView.swift. */
export const AccentColorOptions = [
	{ id: 'blue', displayName: 'Blue', hex: '#007AFF' },
	{ id: 'indigo', displayName: 'Indigo', hex: '#5856D6' },
	{ id: 'purple', displayName: 'Purple', hex: '#AF52DE' },
	{ id: 'pink', displayName: 'Pink', hex: '#FF2D55' },
	{ id: 'red', displayName: 'Red', hex: '#FF3B30' },
	{ id: 'orange', displayName: 'Orange', hex: '#FF9500' },
	{ id: 'yellow', displayName: 'Yellow', hex: '#FFCC00' },
	{ id: 'green', displayName: 'Green', hex: '#34C759' },
	{ id: 'teal', displayName: 'Teal', hex: '#5AC8FA' },
	{ id: 'mint', displayName: 'Mint', hex: '#00C7BE' },
	{ id: 'cyan', displayName: 'Cyan', hex: '#32D2F0' }
] as const;

export type AccentColorOption = (typeof AccentColorOptions)[number];

const purple = '#AF52DE';

/** The saved accent, or purple when none is chosen. */
export function useAccentColor(): string {
	const [hex] = useStoredString(Keys.accentColorHex, '');
	return parseHex(hex) ?? purple;
}

export function useAccentColorHex(): [string, (hex: string) => void] {
	return useStoredString(Keys.accentColorHex, '');
}
