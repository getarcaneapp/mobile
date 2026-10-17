/** Port of `SystemBackupDetailView` (SystemBackupDetailView.swift). */
import { Host } from '@/ui/host';
import { Button, ConfirmationDialog, LabeledContent, List, Section, Text } from '@expo/ui/swift-ui';
import { disabled, listStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import type { BackupHistoryEntry } from '@/sdk/models/backup/BackupHistoryEntry';
import { FormSecureField } from '@/ui/components/form-fields';

import { BackupDestinationPicker } from './backup-forms-screens';
import { useDetailEntryParam } from './backup-routes';
import { NavigationTextRow, RedText } from './backup-rows';
import { useSystemBackupDetail } from './use-system-backup-detail';

function Value({ label, value }: { label: string; value: string }) {
	return (
		<LabeledContent label={label}>
			<Text>{value}</Text>
		</LabeledContent>
	);
}

function SystemBackupDetail({ entry }: { entry: BackupHistoryEntry }) {
	const model = useSystemBackupDetail(entry);
	return (
		<>
			<Stack.Screen options={{ title: 'Backup Details' }} />
			<Host style={{ flex: 1 }}>
				<ConfirmationDialog
					title={model.confirmTitle}
					titleVisibility="visible"
					isPresented={model.pending !== undefined}
					onIsPresentedChange={(isPresented) => {
						if (!isPresented) model.setPending(undefined);
					}}
				>
					<ConfirmationDialog.Trigger>
						<List modifiers={[listStyle('insetGrouped'), disabled(model.busy)]}>
							<Section title="Backup">
								<Value label="Resource" value={entry.resourceName} />
								<Value label="Status" value={entry.status} />
								<Value label="Storage" value={entry.destination} />
								<Value label="Size" value={model.sizeText} />
								{entry.error !== undefined ? <RedText>{entry.error}</RedText> : null}
							</Section>
							{model.errorMessage !== undefined ? <RedText>{model.errorMessage}</RedText> : null}
							{!model.isVolume ? (
								<Section footer={<Text>Leave empty to use the server's configured key.</Text>}>
									<FormSecureField
										title="Recovery key"
										placeholder=""
										text={model.recoveryKey}
										onChangeText={model.setRecoveryKey}
									/>
								</Section>
							) : null}
							{entry.status === 'succeeded' ? (
								<>
									<NavigationTextRow title={model.filesTitle} onPress={model.openFiles} />
									{model.canRestore ? (
										<Button
											label={model.restoreTitle}
											role="destructive"
											onPress={() => model.setPending('restore')}
										/>
									) : null}
									{model.canManage ? (
										<Section title="Upload to S3">
											<BackupDestinationPicker
												selection={model.destinationID}
												onSelectionChange={model.setDestinationID}
												destinations={model.destinations}
											/>
											<Button
												label="Upload"
												onPress={model.upload}
												modifiers={[disabled(model.destinationID === '')]}
											/>
										</Section>
									) : null}
								</>
							) : null}
							{model.canManage ? (
								<Button
									label="Delete backup"
									role="destructive"
									onPress={() => model.setPending('delete')}
								/>
							) : null}
						</List>
					</ConfirmationDialog.Trigger>
					<ConfirmationDialog.Actions>
						<Button label={model.confirmAction} role="destructive" onPress={model.confirm} />
					</ConfirmationDialog.Actions>
					<ConfirmationDialog.Message>
						<Text>{model.confirmMessage}</Text>
					</ConfirmationDialog.Message>
				</ConfirmationDialog>
			</Host>
		</>
	);
}

export function SystemBackupDetailScreen() {
	const entry = useDetailEntryParam();
	if (!entry) return <Stack.Screen options={{ title: 'Backup Details' }} />;
	return <SystemBackupDetail entry={entry} />;
}
