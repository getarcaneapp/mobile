/** Port of `BackupPolicyEditor` (BackupPolicyEditor.swift). */
import { Button, Section, Stepper, Toggle } from '@expo/ui/swift-ui';

import { FormPicker, FormTextField } from '@/ui/components/form-fields';

import { BackupFormChrome } from './backup-form-chrome';
import { BackupDestinationPicker } from './backup-forms-screens';
import { usePolicyEditorParam } from './backup-routes';
import { RedText } from './backup-rows';
import { policyVolumeSelectionOptions, useBackupPolicyEditor } from './use-backup-policy-editor';

export function BackupPolicyEditorScreen() {
	const model = useBackupPolicyEditor(usePolicyEditorParam());
	return (
		<BackupFormChrome
			title="Backup Policies"
			presentation="push"
			disabled={model.busy}
			confirm={{ label: 'Save', disabled: model.saveDisabled, onPress: model.save }}
		>
			{model.errorMessage !== undefined ? (
				<Section>
					<RedText>{model.errorMessage}</RedText>
				</Section>
			) : null}
			{model.policies.map((policy) => {
				const set = (patch: Parameters<typeof model.update>[1]) => model.update(policy.id, patch);
				return (
					<Section key={policy.id} title="Policy">
						<Toggle
							label="Enabled"
							isOn={policy.enabled}
							onIsOnChange={(enabled) => set({ enabled })}
						/>
						<FormTextField
							title="Cron schedule"
							placeholder=""
							text={policy.schedule}
							onChangeText={(schedule) => set({ schedule })}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<Stepper
							label={`Keep ${policy.retentionCount} backups`}
							value={policy.retentionCount}
							min={0}
							max={3650}
							step={1}
							onValueChange={(retentionCount) => set({ retentionCount })}
						/>
						<Toggle
							label="Local storage"
							isOn={policy.localEnabled}
							onIsOnChange={(localEnabled) => set({ localEnabled })}
						/>
						<Toggle
							label="S3 storage"
							isOn={policy.s3Enabled}
							onIsOnChange={(s3Enabled) => set({ s3Enabled })}
						/>
						{policy.s3Enabled ? (
							<BackupDestinationPicker
								selection={policy.s3DestinationId}
								onSelectionChange={(s3DestinationId) => set({ s3DestinationId })}
								destinations={model.destinations}
							/>
						) : null}
						{model.showsStopContainers ? (
							<Toggle
								label="Stop containers during backup"
								isOn={policy.stopContainers}
								onIsOnChange={(stopContainers) => set({ stopContainers })}
							/>
						) : null}
						{model.systemVolumes ? (
							<>
								<FormPicker
									title="Volumes"
									selection={policy.selectionMode}
									onSelectionChange={(selectionMode) => set({ selectionMode })}
									options={policyVolumeSelectionOptions}
								/>
								{policy.selectionMode !== 'all' ? (
									<FormTextField
										title="Volume names, one per line"
										placeholder=""
										text={policy.volumeNames}
										onChangeText={(volumeNames) => set({ volumeNames })}
										autocapitalization="never"
										autocorrectionDisabled
										axis="vertical"
									/>
								) : null}
								<Toggle
									label="Ignore anonymous volumes"
									isOn={policy.ignoreAnonymous}
									onIsOnChange={(ignoreAnonymous) => set({ ignoreAnonymous })}
								/>
							</>
						) : null}
						<Button
							label="Remove policy"
							role="destructive"
							onPress={() => model.remove(policy.id)}
						/>
					</Section>
				);
			})}
			{model.loaded ? <Button label="Add policy" onPress={model.add} /> : null}
		</BackupFormChrome>
	);
}
