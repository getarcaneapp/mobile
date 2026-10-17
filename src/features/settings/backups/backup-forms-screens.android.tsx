import { Share, Text } from 'react-native';

import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import { colors } from '@/theme/colors';
import { FormPicker, FormSecureField } from '@/ui/components/form-fields';
import { m3Type } from '@/ui/components/type-scale';

import { M3Section, SwitchRow, TextButtonRow } from '../shared/android-material';
import { AndroidErrorText, AndroidFormScreen } from './backup-android';
import { destinationPickerOptions, storageOptions } from './backup-policy-draft';
import {
	useBackupRecoveryKey,
	useSystemBackupCreate,
	useSystemVolumeRun,
	volumeSelectionOptions
} from './use-backup-forms';

export function BackupDestinationPicker({
	selection,
	onSelectionChange,
	destinations
}: {
	selection: string;
	onSelectionChange: (value: string) => void;
	destinations: S3Destination[];
}) {
	return (
		<FormPicker
			title="S3 destination"
			selection={selection}
			onSelectionChange={onSelectionChange}
			options={destinationPickerOptions(selection, destinations)}
		/>
	);
}

function SystemBackupCreateForm({
	discover,
	presentation
}: {
	discover: boolean;
	presentation: 'push' | 'sheet';
}) {
	const model = useSystemBackupCreate(discover);
	const picker = (
		<BackupDestinationPicker
			selection={model.s3ID}
			onSelectionChange={model.setS3ID}
			destinations={model.destinations}
		/>
	);
	return (
		<AndroidFormScreen
			title={model.title}
			disabled={model.busy}
			cancel={presentation === 'sheet' ? model.cancel : undefined}
			confirm={{
				label: model.confirmTitle,
				disabled: model.confirmDisabled,
				onPress: model.submit
			}}
		>
			<AndroidErrorText message={model.errorMessage} />
			{discover ? (
				<M3Section footer="Searches for Arcane system backups in the selected destination's existing recovery repository. Choose the destination and path originally used for those backups.">
					{picker}
				</M3Section>
			) : (
				<M3Section>
					<FormPicker
						title="Storage"
						selection={model.destination}
						onSelectionChange={model.setDestination}
						options={storageOptions}
					/>
					{model.destination !== 'local' ? picker : null}
				</M3Section>
			)}
			<M3Section footer="Enter the recovery key for remote backups, or leave it empty to use the server's stored key.">
				<FormSecureField
					title="Recovery key"
					placeholder=""
					text={model.recoveryKey}
					onChangeText={model.setRecoveryKey}
				/>
			</M3Section>
		</AndroidFormScreen>
	);
}

export function SystemBackupCreateScreen() {
	return <SystemBackupCreateForm discover={false} presentation="sheet" />;
}

export function SystemBackupDiscoverScreen() {
	return <SystemBackupCreateForm discover presentation="push" />;
}

export function SystemVolumeRunScreen() {
	const model = useSystemVolumeRun();
	return (
		<AndroidFormScreen
			title="Back Up Volumes"
			disabled={model.busy}
			cancel={model.cancel}
			confirm={{ label: 'Run', disabled: model.runDisabled, onPress: model.run }}
		>
			<AndroidErrorText message={model.errorMessage} />
			<M3Section>
				<FormPicker
					title="Storage"
					selection={model.destination}
					onSelectionChange={model.setDestination}
					options={storageOptions}
				/>
				{model.destination !== 'local' ? (
					<BackupDestinationPicker
						selection={model.s3ID}
						onSelectionChange={model.setS3ID}
						destinations={model.destinations}
					/>
				) : null}
				<SwitchRow
					title="Stop containers during backup"
					value={model.stopContainers}
					onValueChange={model.setStopContainers}
				/>
				<SwitchRow
					title="Ignore anonymous volumes"
					value={model.ignoreAnonymous}
					onValueChange={model.setIgnoreAnonymous}
				/>
				<FormPicker
					title="Volumes"
					selection={model.selectionMode}
					onSelectionChange={model.setSelectionMode}
					options={volumeSelectionOptions}
				/>
				{model.selectionMode !== 'all'
					? model.options.map((option) => (
							<SwitchRow
								key={option.name}
								title={option.name}
								value={model.selected.has(option.name)}
								onValueChange={(isOn) => model.toggleVolume(option.name, isOn)}
								disabled={!option.available}
							/>
						))
					: null}
			</M3Section>
		</AndroidFormScreen>
	);
}

export function BackupRecoveryKeyScreen() {
	const model = useBackupRecoveryKey();
	return (
		<AndroidFormScreen title="Recovery Key" disabled={model.busy}>
			<M3Section>
				<FormSecureField
					title="Recovery key"
					placeholder=""
					text={model.key}
					onChangeText={model.setKey}
				/>
				<TextButtonRow title="Generate key" onPress={model.generate} />
				{model.key !== '' ? (
					<>
						<TextButtonRow title="Copy recovery key" onPress={model.copy} />
						<TextButtonRow
							title="Export recovery key"
							onPress={() => void Share.share({ message: model.key })}
						/>
						<TextButtonRow title="Save recovery key on server" onPress={model.save} />
					</>
				) : null}
				{model.message !== undefined ? (
					<Text
						style={[
							m3Type.bodyMedium,
							{ color: colors.label, paddingHorizontal: 16, paddingVertical: 12 }
						]}
					>
						{model.message}
					</Text>
				) : null}
			</M3Section>
		</AndroidFormScreen>
	);
}
