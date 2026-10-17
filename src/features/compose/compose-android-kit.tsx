/**
 * Material 3 building blocks for the Android native Compose editor: a
 * full-screen dialog (SwiftUI `.sheet` with Cancel/confirm), list rows,
 * inline text inputs, choice menus, and the error line every Swift form shows.
 *
 * Standalone (RN views). Android only.
 */
import { MenuView } from '@react-native-menu/menu';
import type { ReactNode } from 'react';
import {
	KeyboardAvoidingView,
	Modal,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
	type KeyboardTypeOptions
} from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

export const ripple = { color: colors.separator as string };

/** A Material full-screen dialog: close icon, title, and a confirm text button. */
export function FullScreenDialog({
	visible,
	title,
	onClose,
	confirmTitle,
	onConfirm,
	confirmDisabled,
	scrolls = true,
	children
}: {
	visible: boolean;
	title: string;
	onClose: () => void;
	confirmTitle?: string;
	onConfirm?: () => void;
	confirmDisabled?: boolean;
	scrolls?: boolean;
	children: ReactNode;
}) {
	return (
		<Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
			<KeyboardAvoidingView
				behavior="height"
				style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
			>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						height: 64,
						paddingHorizontal: 4,
						paddingTop: 0,
						backgroundColor: colors.systemBackground
					}}
				>
					<Pressable
						onPress={onClose}
						accessibilityRole="button"
						accessibilityLabel="Cancel"
						android_ripple={{ ...ripple, borderless: true, radius: 20 }}
						style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
					>
						<Icon name="xmark" size={24} color={m3.onSurfaceVariant} />
					</Pressable>
					<Text
						style={[m3Type.titleLarge, { color: colors.label, flex: 1, marginLeft: 8 }]}
						numberOfLines={1}
					>
						{title}
					</Text>
					{confirmTitle && onConfirm ? (
						<Pressable
							onPress={onConfirm}
							disabled={confirmDisabled}
							accessibilityRole="button"
							style={{
								paddingHorizontal: 16,
								height: 48,
								justifyContent: 'center',
								opacity: confirmDisabled ? 0.38 : 1
							}}
						>
							<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{confirmTitle}</Text>
						</Pressable>
					) : null}
				</View>
				{scrolls ? (
					<ScrollView
						contentContainerStyle={{ paddingBottom: 48 }}
						keyboardShouldPersistTaps="handled"
					>
						{children}
					</ScrollView>
				) : (
					<View style={{ flex: 1 }}>{children}</View>
				)}
			</KeyboardAvoidingView>
		</Modal>
	);
}

/** A tappable list row with optional supporting text and a trailing value or chevron. */
export function NavRow({
	title,
	subtitle,
	value,
	icon,
	iconColor,
	onPress,
	disabled,
	chevron = true
}: {
	title: string;
	subtitle?: string;
	value?: string;
	icon?: string;
	iconColor?: string;
	onPress?: () => void;
	disabled?: boolean;
	chevron?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled || !onPress}
			accessibilityRole={onPress ? 'button' : undefined}
			android_ripple={ripple}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: subtitle ? 72 : 56,
				paddingHorizontal: 16,
				paddingVertical: 8,
				opacity: disabled ? 0.5 : 1
			}}
		>
			{icon ? <Icon name={icon} size={24} color={iconColor ?? colors.secondaryLabel} /> : null}
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]} numberOfLines={2}>
					{title}
				</Text>
				{subtitle ? (
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]} numberOfLines={2}>
						{subtitle}
					</Text>
				) : null}
			</View>
			{value !== undefined ? (
				<Text
					style={[
						m3Type.bodyMedium,
						{ color: colors.secondaryLabel, maxWidth: '50%', textAlign: 'right' }
					]}
					numberOfLines={3}
				>
					{value}
				</Text>
			) : null}
			{chevron && onPress ? (
				<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
			) : null}
		</Pressable>
	);
}

/** `LabeledContent(title) { TextField(...) }`: title left, input right. */
export function InlineInput({
	title,
	value,
	onChangeText,
	placeholder,
	editable = true,
	keyboardType,
	secure,
	autoFocus,
	multiline
}: {
	title?: string;
	value: string;
	onChangeText: (text: string) => void;
	placeholder?: string;
	editable?: boolean;
	keyboardType?: KeyboardTypeOptions;
	secure?: boolean;
	autoFocus?: boolean;
	multiline?: boolean;
}) {
	return (
		<View
			style={{
				flexDirection: title ? 'row' : 'column',
				alignItems: title ? 'center' : 'stretch',
				gap: 16,
				minHeight: 56,
				paddingHorizontal: 16,
				paddingVertical: 6
			}}
		>
			{title ? (
				<Text style={[m3Type.bodyLarge, { color: colors.label, flexShrink: 1 }]}>{title}</Text>
			) : null}
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder ?? title}
				placeholderTextColor={colors.tertiaryLabel as string}
				editable={editable}
				keyboardType={keyboardType}
				secureTextEntry={secure}
				autoFocus={autoFocus}
				multiline={multiline}
				autoCapitalize="none"
				autoCorrect={false}
				accessibilityLabel={title ?? placeholder}
				cursorColor={m3.primary as string}
				style={[
					m3Type.bodyLarge,
					{
						flex: title ? 1 : undefined,
						textAlign: title ? 'right' : 'left',
						color: editable ? colors.label : colors.secondaryLabel,
						paddingVertical: 8,
						minHeight: multiline ? 96 : undefined,
						textAlignVertical: multiline ? 'top' : 'center'
					}
				]}
			/>
		</View>
	);
}

export type Choice = { value: string; label: string };

/** `Picker(title, selection:)` in a Form: a row showing the current label that opens a menu. */
export function ChoiceRow({
	title,
	selection,
	choices,
	onSelect,
	disabled
}: {
	title: string;
	selection: string;
	choices: Choice[];
	onSelect: (value: string) => void;
	disabled?: boolean;
}) {
	const current = choices.find((choice) => choice.value === selection);
	const row = (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 56,
				paddingHorizontal: 16,
				opacity: disabled ? 0.5 : 1
			}}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
			<Text
				style={[m3Type.bodyLarge, { color: colors.secondaryLabel, maxWidth: '60%' }]}
				numberOfLines={1}
			>
				{current?.label ?? selection}
			</Text>
			<Icon name="chevron.up.chevron.down" size={18} color={colors.secondaryLabel} />
		</View>
	);
	if (disabled) return row;
	return (
		<MenuView
			shouldOpenOnLongPress={false}
			title={title}
			actions={choices.map((choice, index) => ({
				id: String(index),
				title: choice.label,
				state: choice.value === selection ? 'on' : 'off'
			}))}
			onPressAction={({ nativeEvent }) => {
				const choice = choices[Number(nativeEvent.event)];
				if (choice) onSelect(choice.value);
			}}
		>
			{row}
		</MenuView>
	);
}

export function ErrorText({ error }: { error?: string }) {
	if (!error) return null;
	return (
		<Text
			style={[
				m3Type.bodyMedium,
				{ color: systemColors.red, paddingHorizontal: 16, paddingVertical: 10 }
			]}
		>
			{error}
		</Text>
	);
}

export function SecondaryText({ children }: { children: ReactNode }) {
	return (
		<Text
			style={[
				m3Type.bodyMedium,
				{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingVertical: 14 }
			]}
		>
			{children}
		</Text>
	);
}

export function TextAction({
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
			android_ripple={ripple}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				minHeight: 48,
				paddingHorizontal: 16,
				opacity: disabled ? 0.38 : 1
			}}
		>
			{icon ? <Icon name={icon} size={20} color={m3.primary} /> : null}
			<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{title}</Text>
		</Pressable>
	);
}

/** `ContentUnavailableView` inside a list. */
export function EmptyRow({
	icon,
	title,
	description
}: {
	icon: string;
	title: string;
	description?: string;
}) {
	return (
		<View style={{ alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 16 }}>
			<Icon name={icon} size={40} color={colors.secondaryLabel} />
			<Text style={[m3Type.titleMedium, { color: colors.label, textAlign: 'center' }]}>
				{title}
			</Text>
			{description ? (
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
					{description}
				</Text>
			) : null}
		</View>
	);
}

export function Divider() {
	return <View style={{ height: 1, marginLeft: 16, backgroundColor: colors.separator }} />;
}
