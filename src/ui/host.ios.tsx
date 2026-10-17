/**
 * SwiftUI `Host` with the app accent applied as the SwiftUI tint
 * (`seedColor` → `.tint(accent)`), matching the reference app's root
 * `.appAccentColor(_:)`. Without it SwiftUI `Toggle`s render system green.
 * Every other prop passes straight through; an explicit `seedColor` wins, and
 * controls with their own `tint(...)` keep it (inner tint overrides).
 */
import { Host as SwiftUIHost, type HostProps } from '@expo/ui/swift-ui';

import { useAccentColor } from '@/theme/accent';

export type { HostProps };

export function Host({ seedColor, ...props }: HostProps) {
	const accent = useAccentColor();
	return <SwiftUIHost {...props} seedColor={seedColor ?? accent} />;
}
