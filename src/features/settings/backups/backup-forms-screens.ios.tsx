/**
 * Ports of `SystemBackupCreateView`, `SystemVolumeRunView` and
 * `BackupRecoveryKeyView` (SystemBackupsView.swift).
 */
import { Button, Label, Section, ShareLink, Text, Toggle } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';

import type { S3Destination } from '@/sdk/models/backup/S3Destination';
import { FormPicker, FormSecureField } from '@/ui/components/form-fields';

import { BackupFormChrome } from './backup-form-chrome';
import { destinationPickerOptions, storageOptions } from './backup-policy-draft';
import { RedText } from './backup-rows';
import {
	useBackupRecoveryKey,
	useSystemBackupCreate,
	useSystemVolumeRun,
	volumeSelectionOptions
} from './use-backup-forms';

/** `BackupDestinationPicker`. SwiftUI-tree. */
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
		<BackupFormChrome
			title={model.title}
			presentation={presentation}
			disabled={model.busy}
			onCancel={model.cancel}
			confirm={{
				label: model.confirmTitle,
				disabled: model.confirmDisabled,
				onPress: model.submit
			}}
		>
			{model.errorMessage !== undefined ? <RedText>{model.errorMessage}</RedText> : null}
			{!discover ? (
				<FormPicker
					title="Storage"
					selection={model.destination}
					onSelectionChange={model.setDestination}
					options={storageOptions}
				/>
			) : null}
			{discover ? (
				<Section
					footer={
						<Text>
							Searches for Arcane system backups in the selected destination's existing recovery
							repository. Choose the destination and path originally used for those backups.
						</Text>
					}
				>
					{picker}
				</Section>
			) : model.destination !== 'local' ? (
				picker
			) : null}
			<Section
				footer={
					<Text>
						Enter the recovery key for remote backups, or leave it empty to use the server's stored
						key.
					</Text>
				}
			>
				<FormSecureField
					title="Recovery key"
					placeholder=""
					text={model.recoveryKey}
					onChangeText={model.setRecoveryKey}
				/>
			</Section>
		</BackupFormChrome>
	);
}

/** `SystemBackupCreateView()` in a sheet with Cancel. */
export function SystemBackupCreateScreen() {
	return <SystemBackupCreateForm discover={false} presentation="sheet" />;
}

/** `SystemBackupCreateView(discover: true)` pushed from Backup Settings. */
export function SystemBackupDiscoverScreen() {
	return <SystemBackupCreateForm discover presentation="push" />;
}

/** `SystemVolumeRunView` in a sheet with Cancel. */
export function SystemVolumeRunScreen() {
	const model = useSystemVolumeRun();
	return (
		<BackupFormChrome
			title="Back Up Volumes"
			presentation="sheet"
			disabled={model.busy}
			onCancel={model.cancel}
			confirm={{ label: 'Run', disabled: model.runDisabled, onPress: model.run }}
		>
			{model.errorMessage !== undefined ? <RedText>{model.errorMessage}</RedText> : null}
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
			<Toggle
				label="Stop containers during backup"
				isOn={model.stopContainers}
				onIsOnChange={model.setStopContainers}
			/>
			<Toggle
				label="Ignore anonymous volumes"
				isOn={model.ignoreAnonymous}
				onIsOnChange={model.setIgnoreAnonymous}
			/>
			<FormPicker
				title="Volumes"
				selection={model.selectionMode}
				onSelectionChange={model.setSelectionMode}
				options={volumeSelectionOptions}
			/>
			{model.selectionMode !== 'all'
				? model.options.map((option) => (
						<Toggle
							key={option.name}
							label={option.name}
							isOn={model.selected.has(option.name)}
							onIsOnChange={(isOn) => model.toggleVolume(option.name, isOn)}
							modifiers={[disabled(!option.available)]}
						/>
					))
				: null}
		</BackupFormChrome>
	);
}

/** `BackupRecoveryKeyView`. */
export function BackupRecoveryKeyScreen() {
	const model = useBackupRecoveryKey();
	return (
		<BackupFormChrome title="Recovery Key" presentation="push" disabled={model.busy}>
			<FormSecureField
				title="Recovery key"
				placeholder=""
				text={model.key}
				onChangeText={model.setKey}
			/>
			<Button label="Generate key" onPress={model.generate} />
			{model.key !== '' ? (
				<>
					<Button label="Copy recovery key" onPress={model.copy} />
					<ShareLink item={model.key}>
						<Label title="Export recovery key" systemImage="square.and.arrow.up" />
					</ShareLink>
					<Button label="Save recovery key on server" onPress={model.save} />
				</>
			) : null}
			{model.message !== undefined ? <Text>{model.message}</Text> : null}
		</BackupFormChrome>
	);
}
