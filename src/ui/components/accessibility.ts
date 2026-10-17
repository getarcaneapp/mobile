import { useEffect, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** `@Environment(\.accessibilityReduceMotion)`. */
export function useReduceMotion(): boolean {
	return useReducedMotion();
}

/** `@Environment(\.accessibilityReduceTransparency)`. */
export function useReduceTransparency(): boolean {
	const [enabled, setEnabled] = useState(false);
	useEffect(() => {
		let mounted = true;
		void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
			if (mounted) setEnabled(value);
		});
		const subscription = AccessibilityInfo.addEventListener(
			'reduceTransparencyChanged',
			setEnabled
		);
		return () => {
			mounted = false;
			subscription.remove();
		};
	}, []);
	return enabled;
}

/** `@Environment(\.colorScheme)`, defaulting to light. */
export function useIsDark(): boolean {
	return useColorScheme() === 'dark';
}

/**
 * UIKit grouped-background colors as hex, per appearance, for places that need
 * them mixed with opacity (PlatformColor can't be faded in JS).
 */
export const groupedHex = {
	light: {
		systemBackground: '#FFFFFF',
		systemGroupedBackground: '#F2F2F7',
		secondarySystemGroupedBackground: '#FFFFFF',
		tertiarySystemGroupedBackground: '#F2F2F7'
	},
	dark: {
		systemBackground: '#000000',
		systemGroupedBackground: '#000000',
		secondarySystemGroupedBackground: '#1C1C1E',
		tertiarySystemGroupedBackground: '#2C2C2E'
	}
} as const;

/** `.secondary` foreground as hex (UIKit secondaryLabel without its alpha). */
export const secondaryHex = { light: '#3C3C43', dark: '#EBEBF5' } as const;
