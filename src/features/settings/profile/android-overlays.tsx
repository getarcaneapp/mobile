/**
 * Material 3 overlays for the Android profile screens: a modal bottom sheet
 * (SwiftUI `.sheet`) and a text-prompt dialog (SwiftUI `.alert` with a
 * `TextField`). RN `Modal`s so text input and the keyboard behave.
 *
 * Standalone (RN views). Android only.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';

function DialogTextButton({
	title,
	onPress,
	disabled
}: {
	title: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			android_ripple={{ color: colors.separator as string }}
			style={{
				minHeight: 40,
				paddingHorizontal: 12,
				borderRadius: 20,
				overflow: 'hidden',
				justifyContent: 'center',
				opacity: disabled ? 0.38 : 1
			}}
		>
			<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{title}</Text>
		</Pressable>
	);
}

export function TextPromptDialog({
	visible,
	title,
	message,
	placeholder,
	value,
	onChangeText,
	confirmTitle,
	confirmDisabled,
	onConfirm,
	onCancel
}: {
	visible: boolean;
	title: string;
	message?: string;
	placeholder: string;
	value: string;
	onChangeText: (text: string) => void;
	confirmTitle: string;
	confirmDisabled?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onCancel}
			statusBarTranslucent
		>
			<KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
				<Pressable
					onPress={onCancel}
					style={{
						flex: 1,
						backgroundColor: '#00000052',
						alignItems: 'center',
						justifyContent: 'center',
						padding: 24
					}}
				>
					<Pressable
						onPress={() => {}}
						style={{
							width: '100%',
							maxWidth: 560,
							borderRadius: 28,
							padding: 24,
							gap: 16,
							backgroundColor: m3.surfaceContainerHigh
						}}
					>
						<Text style={[m3Type.headlineSmall, { color: colors.label }]}>{title}</Text>
						{message ? (
							<Text style={[m3Type.bodyMedium, { color: m3.onSurfaceVariant }]}>{message}</Text>
						) : null}
						<TextInput
							value={value}
							onChangeText={onChangeText}
							placeholder={placeholder}
							placeholderTextColor={colors.secondaryLabel as string}
							accessibilityLabel={placeholder}
							autoFocus
							onSubmitEditing={confirmDisabled ? undefined : onConfirm}
							style={[
								m3Type.bodyLarge,
								{
									color: colors.label,
									borderWidth: 1,
									borderColor: m3.outline,
									borderRadius: 4,
									paddingHorizontal: 16,
									minHeight: 56
								}
							]}
						/>
						<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
							<DialogTextButton title="Cancel" onPress={onCancel} />
							<DialogTextButton
								title={confirmTitle}
								onPress={onConfirm}
								disabled={confirmDisabled}
							/>
						</View>
					</Pressable>
				</Pressable>
			</KeyboardAvoidingView>
		</Modal>
	);
}

export function ModalSheet({
	visible,
	onDismiss,
	children
}: {
	visible: boolean;
	onDismiss: () => void;
	children: ReactNode;
}) {
	const insets = useSafeAreaInsets();
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onDismiss}
			statusBarTranslucent
		>
			<KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
				<Pressable
					onPress={onDismiss}
					style={{ flex: 1, backgroundColor: '#00000052' }}
					accessibilityLabel="Dismiss"
				/>
				<View
					style={{
						backgroundColor: colors.systemGroupedBackground,
						borderTopLeftRadius: 28,
						borderTopRightRadius: 28,
						paddingBottom: insets.bottom + 8,
						maxHeight: '85%'
					}}
				>
					<View style={{ alignItems: 'center', paddingVertical: 16 }}>
						<View
							style={{
								width: 32,
								height: 4,
								borderRadius: 2,
								backgroundColor: m3.onSurfaceVariant,
								opacity: 0.4
							}}
						/>
					</View>
					{children}
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
