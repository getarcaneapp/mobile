import { FormNumberField, FormPicker, FormTextField } from '@/ui/components/form-fields';

import { M3Section, SwitchRow, TextButtonRow } from '../shared/android-material';
import { AndroidErrorText, AndroidFormScreen } from './backup-android';
import { BackupDestinationPicker } from './backup-forms-screens';
import { usePolicyEditorParam } from './backup-routes';
import { policyVolumeSelectionOptions, useBackupPolicyEditor } from './use-backup-policy-editor';

export function BackupPolicyEditorScreen() {
	const model = useBackupPolicyEditor(usePolicyEditorParam());
	return (
		<AndroidFormScreen
			title="Backup Policies"
			disabled={model.busy}
			confirm={{ label: 'Save', disabled: model.saveDisabled, onPress: model.save }}
		>
			<AndroidErrorText message={model.errorMessage} />
			{model.policies.map((policy) => {
				const set = (patch: Parameters<typeof model.update>[1]) => model.update(policy.id, patch);
				return (
					<M3Section key={policy.id} title="Policy">
						<SwitchRow
							title="Enabled"
							value={policy.enabled}
							onValueChange={(enabled) => set({ enabled })}
						/>
						<FormTextField
							title="Cron schedule"
							placeholder=""
							text={policy.schedule}
							onChangeText={(schedule) => set({ schedule })}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormNumberField
							title={`Keep ${policy.retentionCount} backups`}
							placeholder=""
							text={String(policy.retentionCount)}
							minValue={0}
							maxValue={3650}
							onChangeText={(text) => {
								const value = parseInt(text, 10);
								set({
									retentionCount: Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), 3650)
								});
							}}
						/>
						<SwitchRow
							title="Local storage"
							value={policy.localEnabled}
							onValueChange={(localEnabled) => set({ localEnabled })}
						/>
						<SwitchRow
							title="S3 storage"
							value={policy.s3Enabled}
							onValueChange={(s3Enabled) => set({ s3Enabled })}
						/>
						{policy.s3Enabled ? (
							<BackupDestinationPicker
								selection={policy.s3DestinationId}
								onSelectionChange={(s3DestinationId) => set({ s3DestinationId })}
								destinations={model.destinations}
							/>
						) : null}
						{model.showsStopContainers ? (
							<SwitchRow
								title="Stop containers during backup"
								value={policy.stopContainers}
								onValueChange={(stopContainers) => set({ stopContainers })}
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
								<SwitchRow
									title="Ignore anonymous volumes"
									value={policy.ignoreAnonymous}
									onValueChange={(ignoreAnonymous) => set({ ignoreAnonymous })}
								/>
							</>
						) : null}
						<TextButtonRow
							title="Remove policy"
							destructive
							onPress={() => model.remove(policy.id)}
						/>
					</M3Section>
				);
			})}
			{model.loaded ? (
				<M3Section>
					<TextButtonRow title="Add policy" onPress={model.add} />
				</M3Section>
			) : null}
		</AndroidFormScreen>
	);
}
