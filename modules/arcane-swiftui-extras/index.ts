import { createModifier } from '@expo/ui/swift-ui/modifiers';

export type SymbolRenderingModeType = 'monochrome' | 'hierarchical' | 'palette' | 'multicolor';

export const symbolRenderingMode = (mode: SymbolRenderingModeType) =>
	createModifier('symbolRenderingMode', { mode });

export const appAccentNavigationBar = (color: string) =>
	createModifier('appAccentNavigationBar', { color });
