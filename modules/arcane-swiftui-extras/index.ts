import { createModifier } from '@expo/ui/swift-ui/modifiers';

/**
 * SwiftUI-tree modifiers registered natively by this module (iOS only).
 * Unregistered types are ignored by `@expo/ui`, so these are no-ops on a build
 * that predates the module.
 */
export type SymbolRenderingModeType = 'monochrome' | 'hierarchical' | 'palette' | 'multicolor';

/** SwiftUI `.symbolRenderingMode(_:)`. */
export const symbolRenderingMode = (mode: SymbolRenderingModeType) =>
	createModifier('symbolRenderingMode', { mode });

/**
 * Swift `.appAccentNavigationBar()` (NavigationBar+Accent.swift): accent-tints
 * the Back indicator that Liquid Glass otherwise renders monochrome. Works on
 * react-native-screens headers too (the Host is a child of the screen's view
 * controller). Restores the bar when the view disappears.
 */
export const appAccentNavigationBar = (color: string) =>
	createModifier('appAccentNavigationBar', { color });
