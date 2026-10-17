import type { TextStyle } from 'react-native';

export const m3Type = {
	labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
	labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
	labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
	bodySmall: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
	bodyMedium: { fontSize: 14, lineHeight: 20, letterSpacing: 0.25 },
	bodyLarge: { fontSize: 16, lineHeight: 24, letterSpacing: 0.5 },
	titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
	titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 },
	titleLarge: { fontSize: 22, lineHeight: 28 },
	headlineSmall: { fontSize: 24, lineHeight: 32 }
} satisfies Record<string, TextStyle>;

export const monoFamily = 'monospace';
