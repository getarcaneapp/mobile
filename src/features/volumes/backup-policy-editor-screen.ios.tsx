import { Host } from '@/ui/host';
import { Button, Form, Section, Stepper, Text, Toggle } from '@expo/ui/swift-ui';
import { disabled, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { AppToolbar } from '@/ui/components/toolbar';

import { BackupDestinationPicker } from './backup-destination-picker';
import { useBackupPolicyEditor } from './use-backup-policy-editor';

export function BackupPolicyEditorScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useBackupPolicyEditor(envID, name);

	return (
		<>
			<Stack.Screen options={{ title: 'Backup Policies', headerLargeTitleEnabled: false }} />
			<AppToolbar>
				<Stack.Toolbar.Button disabled={!model.canSave} onPress={model.save}>
					Save
				</Stack.Toolbar.Button>
			</AppToolbar>
			<Host style={{ flex: 1 }}>
				<Form modifiers={[disabled(model.busy)]}>
					{model.errorMessage !== undefined ? (
						<Section>
							<Text modifiers={[foregroundStyle(systemColors.red)]}>{model.errorMessage}</Text>
						</Section>
					) : null}
					{model.policies.map((policy) => (
						<Section key={policy.id} title="Policy">
							<Toggle
								label="Enabled"
								isOn={policy.enabled}
								onIsOnChange={(enabled) => model.update(policy.id, { enabled })}
							/>
							<FormTextField
								title="Cron schedule"
								placeholder=""
								text={policy.schedule}
								onChangeText={(schedule) => model.update(policy.id, { schedule })}
								autocapitalization="never"
								autocorrectionDisabled
							/>
							<Stepper
								label={`Keep ${policy.retentionCount} backups`}
								value={policy.retentionCount}
								min={0}
								max={3650}
								onValueChange={(retentionCount) => model.update(policy.id, { retentionCount })}
							/>
							<Toggle
								label="Local storage"
								isOn={policy.localEnabled}
								onIsOnChange={(localEnabled) => model.update(policy.id, { localEnabled })}
							/>
							<Toggle
								label="S3 storage"
								isOn={policy.s3Enabled}
								onIsOnChange={(s3Enabled) => model.update(policy.id, { s3Enabled })}
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
							<Toggle
								label="Stop containers during backup"
								isOn={policy.stopContainers}
								onIsOnChange={(stopContainers) => model.update(policy.id, { stopContainers })}
							/>
							<Button
								label="Remove policy"
								role="destructive"
								onPress={() => model.remove(policy.id)}
							/>
						</Section>
					))}
					{model.loaded ? <Button label="Add policy" onPress={model.add} /> : null}
				</Form>
			</Host>
		</>
	);
}
