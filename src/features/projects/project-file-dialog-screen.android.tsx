import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';

import { useProjectFileDialog } from './use-project-file-dialog';

export function ProjectFileDialogScreen() {
	const model = useProjectFileDialog();
	return (
		<>
			<Stack.Screen options={{ title: model.title }} />
			<AndroidToolbar
				placement="left"
				items={[
					{ kind: 'button', id: 'cancel', icon: 'xmark', label: 'Cancel', onPress: model.cancel }
				]}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'submit',
						icon: 'checkmark',
						label: model.actionTitle,
						onPress: model.submit
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				{model.needsName ? (
					<M3Section title={model.nameSectionTitle}>
						<FormTextField
							title="Name"
							placeholder={model.namePlaceholder}
							text={model.name}
							onChangeText={model.setName}
							autocapitalization="never"
							autocorrectionDisabled
							monospaced
						/>
					</M3Section>
				) : null}
				{model.needsDestination ? (
					<M3Section title="Destination">
						<FormPicker
							title="Folder"
							selection={model.destinationPath}
							onSelectionChange={model.setDestinationPath}
							options={[
								{ label: 'Project root', value: '' },
								...model.destinationFolders.map((folder) => ({
									label: folder.relativePath,
									value: folder.relativePath
								}))
							]}
						/>
					</M3Section>
				) : null}
				{model.errorMessage !== undefined ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
						<Icon name="exclamationmark.triangle" size={18} color={systemColors.red} />
						<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>
							{model.errorMessage}
						</Text>
					</View>
				) : null}
			</ScrollView>
		</>
	);
}
