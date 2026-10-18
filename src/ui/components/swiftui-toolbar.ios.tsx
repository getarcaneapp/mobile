import { tint } from '@expo/ui/swift-ui/modifiers';

import { useAccentColor } from '@/theme/accent';

export function useAppAccentToolbarSymbol() {
	const accent = useAccentColor();
	return [tint(accent)];
}
