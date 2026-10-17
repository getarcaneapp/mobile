/** Android rendering of `DeleteVariableView` (VariablesView.swift). */
import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/settings/shared/android-toolbar';
import { M3Section, TextButtonRow } from '@/features/settings/shared/android-material';
import { colors, systemColors } from '@/theme/colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { useDeleteVariable } from './use-delete-variable';

function MessageRow({ icon, text, color }: { icon: string; text: string; color: string }) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
			<Icon name={icon} size={20} color={color} />
			<Text style={[m3Type.bodyLarge, { color, flex: 1 }]}>{text}</Text>
		</View>
	);
}

export function DeleteVariableScreen() {
	const model = useDeleteVariable();
	return (
		<>
			<Stack.Screen options={{ title: 'Delete Variable', gestureEnabled: !model.isDeleting }} />
			{model.isDeleting ? (
				<AndroidToolbar items={[{ kind: 'spinner', id: 'delete', label: 'Deleting' }]} />
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section footer="This action cannot be undone.">
					<MessageRow
						icon="exclamationmark.triangle.fill"
						text={model.prompt}
						color={systemColors.orange}
					/>
				</M3Section>
				{model.errorMessage !== undefined ? (
					<M3Section>
						<MessageRow
							icon="exclamationmark.triangle.fill"
							text={model.errorMessage}
							color={systemColors.red}
						/>
					</M3Section>
				) : null}
				<View
					style={{
						flexDirection: 'row',
						justifyContent: 'flex-end',
						gap: 8,
						paddingHorizontal: 16,
						paddingTop: 16
					}}
				>
					<TextButtonRow title="Cancel" onPress={model.cancel} disabled={model.isDeleting} />
					<TextButtonRow
						title="Delete"
						destructive
						onPress={() => void model.remove()}
						disabled={model.isDeleting}
					/>
				</View>
			</ScrollView>
		</>
	);
}
