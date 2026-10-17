import type { ReactNode } from 'react';
import { Pressable, Text, View, type ColorValue } from 'react-native';

import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

/** Material 3 section header for grouped lists. */
export function MaterialSectionHeader({ title }: { title: string }) {
	return (
		<Text
			accessibilityRole="header"
			style={{
				color: colors.secondaryLabel,
				fontSize: 14,
				fontWeight: '500',
				letterSpacing: 0.1,
				paddingHorizontal: 16,
				paddingTop: 20,
				paddingBottom: 6
			}}
		>
			{title}
		</Text>
	);
}

type ListItemProps = {
	headline: string;
	supporting?: string;
	/** SF Symbol name; rendered as the mapped Material Symbol. */
	icon?: string;
	iconColor?: ColorValue;
	leading?: ReactNode;
	trailing?: ReactNode;
	trailingText?: string;
	onPress?: () => void;
	accessibilityHint?: string;
	destructive?: boolean;
};

/** Material 3 one/two-line list item with ripple. */
export function MaterialListItem({
	headline,
	supporting,
	icon,
	iconColor,
	leading,
	trailing,
	trailingText,
	onPress,
	accessibilityHint,
	destructive
}: ListItemProps) {
	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			accessibilityRole={onPress ? 'button' : undefined}
			accessibilityHint={accessibilityHint}
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: supporting ? 72 : 56,
				paddingHorizontal: 16,
				paddingVertical: 8
			}}
		>
			{leading ??
				(icon ? <Icon name={icon} size={24} color={iconColor ?? colors.secondaryLabel} /> : null)}
			<View style={{ flex: 1, gap: 2 }}>
				<Text
					style={{ fontSize: 16, color: destructive ? '#B3261E' : colors.label }}
					numberOfLines={1}
				>
					{headline}
				</Text>
				{supporting ? (
					<Text style={{ fontSize: 14, color: colors.secondaryLabel }} numberOfLines={2}>
						{supporting}
					</Text>
				) : null}
			</View>
			{trailingText ? (
				<Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryLabel }}>
					{trailingText}
				</Text>
			) : null}
			{trailing}
		</Pressable>
	);
}

/** Rounded tonal container grouping list items (Material 3 "list in a card"). */
export function MaterialListGroup({ children }: { children: ReactNode }) {
	return (
		<View
			style={{
				marginHorizontal: 16,
				borderRadius: 24,
				borderCurve: 'continuous',
				overflow: 'hidden',
				backgroundColor: colors.secondarySystemGroupedBackground
			}}
		>
			{children}
		</View>
	);
}
