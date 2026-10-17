import type { ReactNode } from 'react';
import { Pressable, Text, View, type ColorValue } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

export function LinkItem({
	title,
	icon,
	onPress,
	disabled
}: {
	title: string;
	icon?: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 52,
				paddingHorizontal: 16,
				opacity: disabled ? 0.5 : 1
			}}
		>
			{icon ? <Icon name={icon} size={22} color={colors.secondaryLabel} /> : null}
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
			<Icon name="chevron.right" size={16} color={colors.secondaryLabel} />
		</Pressable>
	);
}

export function IconRow({
	title,
	icon,
	iconColor,
	subtitle,
	onPress,
	onLongPress,
	trailing
}: {
	title: string;
	icon: string;
	iconColor?: ColorValue;
	subtitle?: string;
	onPress?: () => void;
	onLongPress?: () => void;
	trailing?: ReactNode;
}) {
	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			disabled={!onPress && !onLongPress}
			accessibilityRole={onPress ? 'button' : undefined}
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 52,
				paddingHorizontal: 16,
				paddingVertical: 8
			}}
		>
			<Icon name={icon} size={22} color={iconColor ?? m3.primary} />
			<View style={{ flex: 1 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{title}</Text>
				{subtitle ? (
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{subtitle}</Text>
				) : null}
			</View>
			{trailing}
		</Pressable>
	);
}

export function TextRow({
	text,
	color,
	small
}: {
	text: string;
	color?: ColorValue;
	small?: boolean;
}) {
	return (
		<Text
			selectable
			style={[
				small ? m3Type.bodySmall : m3Type.bodyMedium,
				{ color: color ?? colors.label, paddingHorizontal: 16, paddingVertical: 12 }
			]}
		>
			{text}
		</Text>
	);
}
