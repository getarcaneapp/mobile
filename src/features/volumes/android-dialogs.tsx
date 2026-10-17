import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';

export function TextPromptDialog({
	visible,
	title,
	message,
	placeholder,
	initialValue,
	confirmTitle,
	onConfirm,
	onCancel
}: {
	visible: boolean;
	title: string;
	message?: string;
	placeholder: string;
	initialValue: string;
	confirmTitle: string;
	onConfirm: (value: string) => void;
	onCancel: () => void;
}) {
	const [value, setValue] = useState(initialValue);
	useEffect(() => {
		if (visible) setValue(initialValue);
	}, [visible, initialValue]);
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
			<View
				style={{
					flex: 1,
					backgroundColor: '#00000052',
					alignItems: 'center',
					justifyContent: 'center',
					padding: 24
				}}
			>
				<View
					style={{
						width: '100%',
						maxWidth: 560,
						borderRadius: 28,
						backgroundColor: m3.surfaceContainerHigh,
						padding: 24,
						gap: 16
					}}
				>
					<Text style={[m3Type.headlineSmall, { color: colors.label }]}>{title}</Text>
					{message ? (
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>{message}</Text>
					) : null}
					<TextInput
						value={value}
						onChangeText={setValue}
						placeholder={placeholder}
						placeholderTextColor={colors.secondaryLabel}
						autoCapitalize="none"
						autoCorrect={false}
						autoFocus
						onSubmitEditing={() => onConfirm(value)}
						style={[
							m3Type.bodyLarge,
							{
								color: colors.label,
								borderWidth: 1,
								borderColor: m3.outline,
								borderRadius: 4,
								paddingHorizontal: 12,
								paddingVertical: 10
							}
						]}
					/>
					<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
						<Pressable
							onPress={onCancel}
							accessibilityRole="button"
							style={{ paddingHorizontal: 12, paddingVertical: 10 }}
						>
							<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Cancel</Text>
						</Pressable>
						<Pressable
							onPress={() => onConfirm(value)}
							accessibilityRole="button"
							style={{ paddingHorizontal: 12, paddingVertical: 10 }}
						>
							<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{confirmTitle}</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}
