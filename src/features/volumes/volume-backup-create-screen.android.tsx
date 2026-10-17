import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { colors } from '@/theme/colors';
import { FormPicker } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import { M3Section } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';

import { BackupDestinationPicker } from './backup-destination-picker';
import { useBackupCreate } from './use-backup-create';

export function VolumeBackupCreateScreen() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const model = useBackupCreate(token);
	if (!model) return null;
	const { state } = model;
	const storageOptions = [
		{ label: 'Local', value: 'local' },
		...(state.supportsPolicies
			? [
					{ label: 'S3', value: 's3' },
					{ label: 'Local and S3', value: 'local_s3' }
				]
			: [])
	];
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: 'Create Backup' }} />
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
			<ScrollView style={{ backgroundColor: colors.systemGroupedBackground }}>
				<M3Section>
					<FormPicker
						title="Storage"
						selection={state.destination}
						onSelectionChange={state.setDestination}
						options={storageOptions}
					/>
					{state.destination !== 'local' ? (
						<BackupDestinationPicker
							selection={state.s3ID}
							onSelectionChange={state.setS3ID}
							destinations={state.destinations}
						/>
					) : null}
				</M3Section>
			</ScrollView>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
