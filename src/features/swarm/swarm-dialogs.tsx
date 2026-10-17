import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';

export type PromptField = {
	placeholder: string;
	value: string;
	onChangeText: (text: string) => void;
	secure?: boolean;
};

export function PromptDialog({
	visible,
	title,
	message,
	fields,
	confirmTitle,
	onConfirm,
	onCancel
}: {
	visible: boolean;
	title: string;
	message?: string;
	fields: PromptField[];
	confirmTitle: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
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
						maxWidth: 420,
						borderRadius: 28,
						padding: 24,
						gap: 16,
						backgroundColor: m3.surfaceContainerHigh
					}}
				>
					<Text style={[m3Type.headlineSmall, { color: colors.label }]}>{title}</Text>
					{message ? (
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>{message}</Text>
					) : null}
					{fields.map((field) => (
						<TextInput
							key={field.placeholder}
							value={field.value}
							onChangeText={field.onChangeText}
							placeholder={field.placeholder}
							placeholderTextColor={colors.secondaryLabel}
							secureTextEntry={field.secure}
							autoCapitalize="none"
							autoCorrect={false}
							accessibilityLabel={field.placeholder}
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
					))}
					<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
						<Pressable
							onPress={onCancel}
							accessibilityRole="button"
							style={{ paddingHorizontal: 12, paddingVertical: 10 }}
						>
							<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Cancel</Text>
						</Pressable>
						<Pressable
							onPress={onConfirm}
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
