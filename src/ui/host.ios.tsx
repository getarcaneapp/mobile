import { Host as SwiftUIHost, type HostProps } from '@expo/ui/swift-ui';

import { useAccentColor } from '@/theme/accent';

export type { HostProps };

export function Host({ seedColor, ...props }: HostProps) {
	const accent = useAccentColor();
	return <SwiftUIHost {...props} seedColor={seedColor ?? accent} />;
}
