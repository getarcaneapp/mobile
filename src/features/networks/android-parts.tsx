/**
 * Small Material 3 pieces shared by the Networks / Ports / Events / Swarm
 * Android screens. Standalone (RN views); import from `.android.tsx` files.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section } from '@/features/containers/android-material';

/** A form's error `Section { Label(error, systemImage: …).foregroundStyle(.red) }`. */
export function SheetError({ message }: { message?: string }) {
	if (!message) return null;
	return (
		<M3Section>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
				<Icon name="exclamationmark.triangle.fill" size={20} color={m3.error} />
				<Text style={[m3Type.bodyMedium, { color: m3.error, flex: 1 }]}>{message}</Text>
			</View>
		</M3Section>
	);
}

/** Section header with optional trailing content (e.g. a resource count). */
export function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				paddingHorizontal: 32,
				paddingTop: 20,
				paddingBottom: 6,
				gap: 8
			}}
		>
			<Text
				accessibilityRole="header"
				style={[m3Type.titleSmall, { color: colors.secondaryLabel, flex: 1 }]}
			>
				{title}
			</Text>
			{trailing}
		</View>
	);
}

/** `LabeledContent` whose value is arbitrary content. */
export function LabeledRow({ title, children }: { title: string; children: ReactNode }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 48,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{title}</Text>
			<View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
		</View>
	);
}

/** `MonospacedValue` for Android rows. */
export function MonoText({
	value,
	color,
	size = 14,
	lines
}: {
	value: string;
	color?: string;
	size?: number;
	lines?: number;
}) {
	return (
		<Text
			selectable={lines === undefined}
			numberOfLines={lines}
			style={{ fontFamily: monoFamily, fontSize: size, color: color ?? colors.secondaryLabel }}
		>
			{value}
		</Text>
	);
}

/** A tappable row with a leading icon and a trailing chevron (`NavigationLink { Label(…) }`). */
export function LinkItem({
	title,
	icon,
	onPress,
	color
}: {
	title: string;
	icon: string;
	onPress: () => void;
	color?: string;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 52,
				paddingHorizontal: 16
			}}
		>
			<Icon name={icon} size={22} color={color ?? m3.primary} />
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
			<Icon name="chevron.right" size={16} color={colors.secondaryLabel} />
		</Pressable>
	);
}

/** A tappable action row (`Button { Label(…) }` in a Form). */
export function ActionItem({
	title,
	icon,
	onPress,
	destructive,
	disabled,
	trailing
}: {
	title: string;
	icon?: string;
	onPress: () => void;
	destructive?: boolean;
	disabled?: boolean;
	trailing?: ReactNode;
}) {
	const color = destructive ? m3.error : m3.primary;
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
				opacity: disabled ? 0.38 : 1
			}}
		>
			{icon ? <Icon name={icon} size={22} color={color} /> : null}
			<Text style={[m3Type.bodyLarge, { color, flex: 1 }]}>{title}</Text>
			{trailing}
		</Pressable>
	);
}

/** Inline "No …" / caption text inside a section. */
export function SecondaryText({ text }: { text: string }) {
	return (
		<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, padding: 16 }]}>{text}</Text>
	);
}
