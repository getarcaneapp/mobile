import { Color } from 'expo-router';
import { Appearance, Platform, type ColorValue } from 'react-native';

function pick(ios: ColorValue, android: ColorValue, web: string): ColorValue {
	return Platform.select({ ios, android, default: web });
}

/**
 * A color table whose values follow the current appearance on Android.
 *
 * Material 3 dynamic colors resolve to fixed hex values for one scheme, so a
 * module-level table would keep the launch appearance forever. On Android
 * each property is a getter that resolves (cached per scheme) on read, so a
 * render after a dark-mode switch picks up the new colors; the root layout
 * re-renders the tree when the scheme changes. iOS colors are dynamic
 * `PlatformColor`s already and resolve once.
 */
export function appearanceColors<T extends Record<string, ColorValue>>(
	resolve: () => T
): Readonly<T> {
	if (Platform.OS !== 'android') return resolve();
	const cache = new Map<string, T>();
	const current = (): T => {
		const scheme = Appearance.getColorScheme() ?? 'unspecified';
		let table = cache.get(scheme);
		if (!table) {
			table = resolve();
			cache.set(scheme, table);
		}
		return table;
	};
	return Object.defineProperties(
		{} as T,
		Object.fromEntries(
			Object.keys(current()).map((name) => [name, { enumerable: true, get: () => current()[name] }])
		)
	);
}

/**
 * Semantic colors. iOS resolves UIKit system colors natively (so they match
 * the SwiftUI app exactly); Android maps to Material 3 dynamic roles.
 */
export const colors = appearanceColors(() => ({
	label: pick(Color.ios.label, Color.android.dynamic.onSurface, '#000000'),
	secondaryLabel: pick(Color.ios.secondaryLabel, Color.android.dynamic.onSurfaceVariant, '#3c3c43'),
	tertiaryLabel: pick(Color.ios.tertiaryLabel, Color.android.dynamic.outline, '#3c3c4399'),
	separator: pick(Color.ios.separator, Color.android.dynamic.outlineVariant, '#c6c6c8'),
	systemBackground: pick(Color.ios.systemBackground, Color.android.dynamic.surface, '#ffffff'),
	secondarySystemBackground: pick(
		Color.ios.secondarySystemBackground,
		Color.android.dynamic.surfaceContainer,
		'#f2f2f7'
	),
	systemGroupedBackground: pick(
		Color.ios.systemGroupedBackground,
		Color.android.dynamic.surface,
		'#f2f2f7'
	),
	secondarySystemGroupedBackground: pick(
		Color.ios.secondarySystemGroupedBackground,
		Color.android.dynamic.surfaceContainerHigh,
		'#ffffff'
	),
	tertiarySystemGroupedBackground: pick(
		Color.ios.tertiarySystemGroupedBackground,
		Color.android.dynamic.surfaceContainerHighest,
		'#f2f2f7'
	)
}));

type SystemColorTable = Record<
	| 'blue'
	| 'green'
	| 'indigo'
	| 'orange'
	| 'pink'
	| 'purple'
	| 'red'
	| 'teal'
	| 'yellow'
	| 'mint'
	| 'cyan'
	| 'brown'
	| 'gray',
	string
>;

/** iOS 18 and Android: the classic system palette (light, dark). */
const classicLight: SystemColorTable = {
	blue: '#007AFF',
	green: '#34C759',
	indigo: '#5856D6',
	orange: '#FF9500',
	pink: '#FF2D55',
	purple: '#AF52DE',
	red: '#FF3B30',
	teal: '#30B0C7',
	yellow: '#FFCC00',
	mint: '#00C7BE',
	cyan: '#32ADE6',
	brown: '#A2845E',
	gray: '#8E8E93'
};
const classicDark: SystemColorTable = {
	blue: '#0A84FF',
	green: '#30D158',
	indigo: '#5E5CE6',
	orange: '#FF9F0A',
	pink: '#FF375F',
	purple: '#BF5AF2',
	red: '#FF453A',
	teal: '#40C8E0',
	yellow: '#FFD60A',
	mint: '#63E6E2',
	cyan: '#64D2FF',
	brown: '#AC8E68',
	gray: '#8E8E93'
};
/** iOS 26+ system palette; dark values sampled from the reference app. */
const ios26Light: SystemColorTable = {
	blue: '#0088FF',
	green: '#34C759',
	indigo: '#6155F5',
	orange: '#FF8D28',
	pink: '#FF2D55',
	purple: '#CB30E0',
	red: '#FF383C',
	teal: '#00C3D0',
	yellow: '#FFCC00',
	mint: '#00C8B3',
	cyan: '#00C0E8',
	brown: '#AC7F5E',
	gray: '#8E8E93'
};
const ios26Dark: SystemColorTable = {
	blue: '#0091FF',
	green: '#30D158',
	indigo: '#6D7CFF',
	orange: '#FF9230',
	pink: '#FF375F',
	purple: '#DB34F2',
	red: '#FF4245',
	teal: '#00D2E0',
	yellow: '#FFD600',
	mint: '#00DAC3',
	cyan: '#3CD3FE',
	brown: '#B78A66',
	gray: '#8E8E93'
};

const isIOS26OrLater = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;

function currentSystemTable(): SystemColorTable {
	const dark = Appearance.getColorScheme() === 'dark';
	if (Platform.OS !== 'ios') return classicLight;
	if (isIOS26OrLater) return dark ? ios26Dark : ios26Light;
	return dark ? classicDark : classicLight;
}

/**
 * SwiftUI's named system colors (`.blue`, `.green`, …) as hex so they can be
 * mixed with opacity. On iOS each read resolves for the current appearance
 * and OS (SwiftUI's colors are dynamic and were retuned in iOS 26); Android
 * keeps the classic light palette as accents.
 */
export const systemColors: Readonly<SystemColorTable> = Object.defineProperties(
	{} as SystemColorTable,
	Object.fromEntries(
		(Object.keys(classicLight) as (keyof SystemColorTable)[]).map((name) => [
			name,
			{ enumerable: true, get: () => currentSystemTable()[name] }
		])
	)
);

export type SystemColorName = keyof typeof systemColors;

/** `Color(hex:)` — returns undefined for anything that isn't `#RRGGBB`. */
export function parseHex(hex: string): string | undefined {
	const cleaned = hex.trim().replace('#', '');
	return /^[0-9a-fA-F]{6}$/.test(cleaned) ? `#${cleaned.toUpperCase()}` : undefined;
}

/** `color.opacity(x)` for hex colors. */
export function withOpacity(hex: string, opacity: number): string {
	const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
		.toString(16)
		.padStart(2, '0');
	return `${hex.slice(0, 7)}${alpha}`;
}

/** Mix a hex color toward white by `amount` (0...1). */
export function lighten(hex: string, amount: number): string {
	const n = parseInt(hex.slice(1, 7), 16);
	const mix = (c: number) => Math.round(c + (255 - c) * amount);
	const r = mix((n >> 16) & 0xff);
	const g = mix((n >> 8) & 0xff);
	const b = mix(n & 0xff);
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()}`;
}

/** SwiftUI `Color.gradient`: a soft top-lit linear gradient of one color. */
export function colorGradient(hex: string) {
	return {
		type: 'linearGradient' as const,
		colors: [lighten(hex, 0.16), hex],
		startPoint: { x: 0.5, y: 0 },
		endPoint: { x: 0.5, y: 1 }
	};
}
