import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListItem } from '@/ui/material/list';

import { AndroidToolbar, type AndroidToolbarItem } from '../shared/android-toolbar';
import { TextButtonRow } from '../shared/android-material';

export function AndroidErrorText({ message }: { message: string | undefined }) {
	if (message === undefined) return null;
	return (
		<Text
			style={[
				m3Type.bodyMedium,
				{ color: systemColors.red, paddingHorizontal: 32, paddingVertical: 12 }
			]}
		>
			{message}
		</Text>
	);
}

export function AndroidErrorRetry({
	message,
	onRetry
}: {
	message: string | undefined;
	onRetry: () => void;
}) {
	if (message === undefined) return null;
	return (
		<View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
			<AndroidErrorText message={message} />
			<TextButtonRow title="Retry" onPress={onRetry} />
		</View>
	);
}

export function NavItem({
	title,
	icon,
	supporting,
	onPress
}: {
	title: string;
	icon?: string;
	supporting?: string;
	onPress: () => void;
}) {
	return (
		<MaterialListItem
			headline={title}
			supporting={supporting}
			icon={icon}
			trailing={<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />}
			onPress={onPress}
		/>
	);
}

export function AndroidFormScreen({
	title,
	confirm,
	cancel,
	disabled,
	children
}: {
	title: string;
	confirm?: { label: string; disabled: boolean; onPress: () => void };
	cancel?: () => void;
	disabled?: boolean;
	children: ReactNode;
}) {
	const items: AndroidToolbarItem[] = [];
	if (confirm) {
		items.push({
			kind: 'button',
			id: 'confirm',
			icon: 'checkmark',
			label: confirm.label,
			disabled: confirm.disabled,
			onPress: confirm.onPress
		});
	}
	return (
		<>
			<Stack.Screen options={{ title }} />
			{cancel ? (
				<AndroidToolbar
					placement="left"
					items={[
						{ kind: 'button', id: 'cancel', icon: 'xmark', label: 'Cancel', onPress: cancel }
					]}
				/>
			) : null}
			{items.length > 0 ? <AndroidToolbar items={items} /> : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
			>
				<View pointerEvents={disabled ? 'none' : 'auto'} style={{ opacity: disabled ? 0.6 : 1 }}>
					{children}
				</View>
			</ScrollView>
		</>
	);
}
