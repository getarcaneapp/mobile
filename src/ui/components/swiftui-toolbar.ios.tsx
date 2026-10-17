import { foregroundStyle, tint } from '@expo/ui/swift-ui/modifiers';

import { useAccentColor } from '@/theme/accent';

export function useAppAccentToolbarSymbol() {
	const accent = useAccentColor();
	return [foregroundStyle(accent), tint(accent)];
}
