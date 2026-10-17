/** Android rendering of the volume flavour of `BackupPolicyEditor` (BackupPolicyEditor.swift). */
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormNumberField, FormTextField } from '@/ui/components/form-fields';

import { M3Section, SwitchRow, TextButtonRow } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';

import { TextRow } from './android-rows';
import { BackupDestinationPicker } from './backup-destination-picker';
import { useBackupPolicyEditor } from './use-backup-policy-editor';

export function BackupPolicyEditorScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useBackupPolicyEditor(envID, name);

	return (
		<>
			<Stack.Screen options={{ title: 'Backup Policies' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'save',
						icon: 'checkmark',
						label: 'Save',
						disabled: !model.canSave,
						onPress: model.save
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<View
					pointerEvents={model.busy ? 'none' : 'auto'}
					style={{ opacity: model.busy ? 0.6 : 1 }}
				>
					{model.errorMessage !== undefined ? (
						<M3Section>
							<TextRow text={model.errorMessage} color={systemColors.red} />
						</M3Section>
					) : null}
					{model.policies.map((policy) => (
						<M3Section key={policy.id} title="Policy">
							<SwitchRow
								title="Enabled"
								value={policy.enabled}
								onValueChange={(enabled) => model.update(policy.id, { enabled })}
							/>
							<FormTextField
								title="Cron schedule"
								placeholder=""
								text={policy.schedule}
								onChangeText={(schedule) => model.update(policy.id, { schedule })}
								autocapitalization="never"
								autocorrectionDisabled
							/>
							<FormNumberField
								title={`Keep ${policy.retentionCount} backups`}
								placeholder="7"
								text={String(policy.retentionCount)}
								onChangeText={(text) => {
									const value = parseInt(text, 10);
									model.update(policy.id, {
										retentionCount: Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), 3650)
									});
								}}
								minValue={0}
								maxValue={3650}
							/>
							<SwitchRow
								title="Local storage"
								value={policy.localEnabled}
								onValueChange={(localEnabled) => model.update(policy.id, { localEnabled })}
							/>
							<SwitchRow
								title="S3 storage"
								value={policy.s3Enabled}
								onValueChange={(s3Enabled) => model.update(policy.id, { s3Enabled })}
							/>
							{policy.s3Enabled ? (
								<BackupDestinationPicker
									selection={policy.s3DestinationId}
									onSelectionChange={(s3DestinationId) =>
										model.update(policy.id, { s3DestinationId })
									}
									destinations={model.destinations}
								/>
							) : null}
							<SwitchRow
								title="Stop containers during backup"
								value={policy.stopContainers}
								onValueChange={(stopContainers) => model.update(policy.id, { stopContainers })}
							/>
							<TextButtonRow
								title="Remove policy"
								destructive
								onPress={() => model.remove(policy.id)}
							/>
						</M3Section>
					))}
					{model.loaded ? (
						<M3Section>
							<TextButtonRow title="Add policy" onPress={model.add} />
						</M3Section>
					) : null}
				</View>
			</ScrollView>
		</>
	);
}
