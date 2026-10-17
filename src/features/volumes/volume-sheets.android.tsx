/** Android renderings of the Create Volume and Rename Volume sheets. */
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { m3Type } from '@/ui/components/type-scale';

import { M3Section } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';

import { useCreateVolume, useRenameVolume, type DriverMode } from './use-volume-sheets';
import { VolumeRename } from './volume-model';

export function CreateVolumeScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useCreateVolume(envID);
	return (
		<>
			<Stack.Screen options={{ title: 'Create Volume' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'create',
						icon: 'checkmark',
						label: 'Create',
						disabled: !model.canCreate,
						onPress: model.create
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Volume Details">
					<FormTextField
						title="Name"
						placeholder="app-data"
						text={model.name}
						onChangeText={model.setName}
						autocapitalization="never"
						autocorrectionDisabled
						helper="Use a stable name so containers can mount this volume later."
					/>
					<FormPicker<DriverMode>
						title="Driver"
						selection={model.driverMode}
						onSelectionChange={model.setDriverMode}
						options={[
							{ label: 'Local', value: 'local' },
							{ label: 'Custom driver', value: 'custom' }
						]}
						helper={model.driverHelper}
					/>
					{model.driverMode === 'custom' ? (
						<FormTextField
							title="Custom Driver"
							placeholder="driver-name"
							text={model.customDriver}
							onChangeText={model.setCustomDriver}
							autocapitalization="never"
							autocorrectionDisabled
						/>
					) : null}
				</M3Section>
				{model.errorMessage ? (
					<Text style={[m3Type.bodyMedium, { color: systemColors.red, padding: 16 }]}>
						{model.errorMessage}
					</Text>
				) : null}
			</ScrollView>
		</>
	);
}

export function RenameVolumeScreen() {
	const {
		name = '',
		envID = '0',
		popsDetail
	} = useLocalSearchParams<{ name?: string; envID?: string; popsDetail?: string }>();
	const model = useRenameVolume(envID, name, popsDetail === '1');
	return (
		<>
			<Stack.Screen options={{ title: 'Rename Volume' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'save',
						icon: 'checkmark',
						label: 'Save',
						disabled: !model.canSave,
						onPress: model.submit
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="New name" footer={VolumeRename.footer}>
					<FormTextField
						title="Volume Name"
						placeholder={name}
						text={model.newName}
						onChangeText={model.setNewName}
						autocapitalization="never"
						autocorrectionDisabled
						helper="Must start with a letter or digit, and contain only letters, digits, underscores, dots, or hyphens."
					/>
				</M3Section>
				{model.errorMessage ? (
					<Text style={[m3Type.bodyMedium, { color: systemColors.red, padding: 16 }]}>
						{model.errorMessage}
					</Text>
				) : null}
			</ScrollView>
		</>
	);
}
