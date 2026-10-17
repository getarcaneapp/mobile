import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import type { BackupHistoryEntry } from '@/sdk/models/backup/BackupHistoryEntry';
import { colors } from '@/theme/colors';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { FormSecureField } from '@/ui/components/form-fields';

import { M3Section, TextButtonRow, ValueRow } from '../shared/android-material';
import { AndroidErrorText, NavItem } from './backup-android';
import { BackupDestinationPicker } from './backup-forms-screens';
import { useDetailEntryParam } from './backup-routes';
import { useSystemBackupDetail } from './use-system-backup-detail';

function SystemBackupDetail({ entry }: { entry: BackupHistoryEntry }) {
	const model = useSystemBackupDetail(entry);
	useItemDeleteConfirmation(model.pending, model.setPending, (operation) => ({
		title: operation === 'restore' ? `Restore ${entry.resourceName}?` : 'Delete backup?',
		message:
			operation === 'restore'
				? 'This replaces existing data. A server restore may disconnect the app. Reconnect and check server state before attempting another restore.'
				: 'This removes the stored backup.',
		actions: [
			{
				title: operation === 'restore' ? 'Restore' : 'Delete',
				action: () => model.perform(operation)
			}
		],
		dismissOnConfirm: false
	}));

	return (
		<>
			<Stack.Screen options={{ title: 'Backup Details' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
			>
				<View
					pointerEvents={model.busy ? 'none' : 'auto'}
					style={{ opacity: model.busy ? 0.6 : 1 }}
				>
					<M3Section title="Backup">
						<ValueRow title="Resource" value={entry.resourceName} />
						<ValueRow title="Status" value={entry.status} />
						<ValueRow title="Storage" value={entry.destination} />
						<ValueRow title="Size" value={model.sizeText} />
						{entry.error !== undefined ? <AndroidErrorText message={entry.error} /> : null}
					</M3Section>
					<AndroidErrorText message={model.errorMessage} />
					{!model.isVolume ? (
						<M3Section footer="Leave empty to use the server's configured key.">
							<FormSecureField
								title="Recovery key"
								placeholder=""
								text={model.recoveryKey}
								onChangeText={model.setRecoveryKey}
							/>
						</M3Section>
					) : null}
					{entry.status === 'succeeded' ? (
						<>
							<M3Section>
								<NavItem title={model.filesTitle} onPress={model.openFiles} />
								{model.canRestore ? (
									<TextButtonRow
										title={model.restoreTitle}
										destructive
										onPress={() => model.setPending('restore')}
									/>
								) : null}
							</M3Section>
							{model.canManage ? (
								<M3Section title="Upload to S3">
									<BackupDestinationPicker
										selection={model.destinationID}
										onSelectionChange={model.setDestinationID}
										destinations={model.destinations}
									/>
									<TextButtonRow
										title="Upload"
										disabled={model.destinationID === ''}
										onPress={model.upload}
									/>
								</M3Section>
							) : null}
						</>
					) : null}
					{model.canManage ? (
						<M3Section>
							<TextButtonRow
								title="Delete backup"
								destructive
								onPress={() => model.setPending('delete')}
							/>
						</M3Section>
					) : null}
				</View>
			</ScrollView>
		</>
	);
}

export function SystemBackupDetailScreen() {
	const entry = useDetailEntryParam();
	if (!entry) return <Stack.Screen options={{ title: 'Backup Details' }} />;
	return <SystemBackupDetail entry={entry} />;
}
