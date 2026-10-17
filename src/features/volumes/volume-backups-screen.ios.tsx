/** Port of `VolumeBackupsView` (VolumeBackupsView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	LabeledContent,
	List,
	Menu,
	Picker,
	Section,
	Spacer,
	Text
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	disabled,
	foregroundStyle,
	frame,
	listStyle,
	refreshable,
	shapes,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { formatFileBytes } from '@/core/networking/remote-data-limits';
import type { BackupEntry } from '@/sdk/models/volume/Backup';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { DisclosureChevron } from '@/ui/settings-row';

import { useVolumeBackups, type VolumeBackupsModel } from './use-volume-backups';

function NavigationRow({ title, onPress }: { title: string; onPress: () => void }) {
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<Text>{title}</Text>
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

function Value({ label, value }: { label: string; value: string }) {
	return (
		<LabeledContent label={label}>
			<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
				{value}
			</Text>
		</LabeledContent>
	);
}

function BackupSection({ model, backup }: { model: VolumeBackupsModel; backup: BackupEntry }) {
	return (
		<Section>
			<Value label={backup.createdAt} value={formatFileBytes(backup.size)} />
			{backup.status !== undefined ? <Value label="Status" value={backup.status} /> : null}
			{backup.destination !== undefined ? (
				<Value label="Storage" value={backup.destination} />
			) : null}
			{backup.s3DestinationName !== undefined ? (
				<Value label="S3 destination" value={backup.s3DestinationName} />
			) : null}
			{backup.remoteInstanceId ? (
				<Value label="Remote instance" value={backup.remoteInstanceId} />
			) : null}
			{backup.error !== undefined ? (
				<Text modifiers={[foregroundStyle(systemColors.red)]}>{backup.error}</Text>
			) : null}
			{model.isUsable(backup) ? (
				<>
					<NavigationRow title="Browse files" onPress={() => model.openFiles(backup)} />
					<Button label="Download archive" onPress={() => model.download(backup)} />
					{model.canBackup ? (
						<>
							<Button
								label="Restore volume"
								role="destructive"
								onPress={() => model.requestRestore(backup)}
							/>
							<Menu label="Upload to S3" modifiers={[disabled(model.destinations.length === 0)]}>
								{model.destinations.map((destination) => (
									<Button
										key={destination.id}
										label={destination.name}
										onPress={() => model.upload(backup, destination.id)}
									/>
								))}
							</Menu>
						</>
					) : null}
				</>
			) : null}
			{model.canBackup ? (
				<Button
					label="Delete backup"
					role="destructive"
					onPress={() => model.requestDelete(backup)}
				/>
			) : null}
		</Section>
	);
}

export function VolumeBackupsScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useVolumeBackups(envID, name);

	return (
		<>
			<Stack.Screen options={{ title: 'Backups', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List
					modifiers={[listStyle('insetGrouped'), disabled(model.busy), refreshable(model.refresh)]}
				>
					{model.errorMessage !== undefined ? (
						<Text modifiers={[foregroundStyle(systemColors.red)]}>{model.errorMessage}</Text>
					) : null}
					{model.warnings.map((warning) => (
						<Text key={warning} modifiers={[foregroundStyle(systemColors.orange)]}>
							{warning}
						</Text>
					))}
					{model.canBackup ? (
						<>
							<Section>
								<Button label="Create backup" onPress={model.openCreate} />
								{model.supportsPolicies ? (
									<NavigationRow title="Backup policies" onPress={model.openPolicies} />
								) : null}
								{model.canUpload ? (
									<Button label="Import and restore archive" onPress={model.pickImport} />
								) : null}
							</Section>
							{model.destinations.length > 0 ? (
								<Section
									header={<Text>Discover S3</Text>}
									footer={
										<Text>
											Import existing volume backups stored on the destination by this or other
											instances.
										</Text>
									}
								>
									<Picker
										label="Destination"
										selection={model.discoverID}
										onSelectionChange={(value: string) => model.setDiscoverID(value)}
									>
										<Text modifiers={[tag('')]}>Select</Text>
										{model.destinations.map((destination) => (
											<Text key={destination.id} modifiers={[tag(destination.id)]}>
												{destination.name}
											</Text>
										))}
									</Picker>
									<Button
										label="Discover backups"
										onPress={model.discover}
										modifiers={[disabled(model.discoverID === '' || model.isDiscovering)]}
									/>
								</Section>
							) : null}
						</>
					) : null}
					{model.downloadFile ? (
						<Button
							label="Share downloaded backup"
							systemImage="square.and.arrow.up"
							onPress={model.shareDownload}
						/>
					) : null}
					{model.backups.map((backup) => (
						<BackupSection key={backup.id} model={model} backup={backup} />
					))}
					<PaginatedListFooter
						hasMore={model.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={model.loadMore}
						onLoadMore={model.loadMore}
					/>
					{model.busy ? (
						<HStack modifiers={[frame({ maxWidth: Infinity })]}>
							<ArcaneLoadingViewSwiftUI fillsWidth />
						</HStack>
					) : null}
				</List>
			</Host>
		</>
	);
}
