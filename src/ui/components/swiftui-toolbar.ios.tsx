/**
 * `appAccentToolbarSymbol()` (Color+Hex.swift) for SwiftUI `ToolbarItem`s in
 * sheets: Swift's `AppToolbarItem` wraps its content in
 * `.foregroundStyle(accent).tint(accent)`. Because that explicit style wins over
 * the disabled dimming, a disabled Create/Save still renders in the accent
 * color there (it just doesn't respond). Spread these modifiers last-but-inner
 * on the item's Button, after any explicit color the Swift button sets itself
 * (an inner `.foregroundStyle(.red)` keeps winning, so skip those).
 *
 * SwiftUI-tree; import only from `.ios.tsx` files.
 */
import { foregroundStyle, tint } from '@expo/ui/swift-ui/modifiers';

import { useAccentColor } from '@/theme/accent';

export function useAppAccentToolbarSymbol() {
	const accent = useAccentColor();
	return [foregroundStyle(accent), tint(accent)];
}
