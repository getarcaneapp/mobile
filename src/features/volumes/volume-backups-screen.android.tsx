/** Android rendering of `VolumeBackupsView` (VolumeBackupsView.swift). */
import { MenuView } from '@react-native-menu/menu';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { formatFileBytes } from '@/core/networking/remote-data-limits';
import type { BackupEntry } from '@/sdk/models/volume/Backup';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormPicker } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { m3Type } from '@/ui/components/type-scale';

import { M3Section, TextButtonRow, ValueRow } from '@/features/containers/android-material';

import { LinkItem, TextRow } from './android-rows';
import { useVolumeBackups, type VolumeBackupsModel } from './use-volume-backups';

function BackupSection({ model, backup }: { model: VolumeBackupsModel; backup: BackupEntry }) {
	const noDestinations = model.destinations.length === 0;
	return (
		<M3Section>
			<ValueRow title={backup.createdAt} value={formatFileBytes(backup.size)} />
			{backup.status !== undefined ? <ValueRow title="Status" value={backup.status} /> : null}
			{backup.destination !== undefined ? (
				<ValueRow title="Storage" value={backup.destination} />
			) : null}
			{backup.s3DestinationName !== undefined ? (
				<ValueRow title="S3 destination" value={backup.s3DestinationName} />
			) : null}
			{backup.remoteInstanceId ? (
				<ValueRow title="Remote instance" value={backup.remoteInstanceId} />
			) : null}
			{backup.error !== undefined ? <TextRow text={backup.error} color={systemColors.red} /> : null}
			{model.isUsable(backup) ? (
				<>
					<LinkItem title="Browse files" onPress={() => model.openFiles(backup)} />
					<TextButtonRow
						title="Download archive"
						onPress={() => model.download(backup)}
						disabled={model.busy}
					/>
					{model.canBackup ? (
						<>
							<TextButtonRow
								title="Restore volume"
								destructive
								onPress={() => model.requestRestore(backup)}
								disabled={model.busy}
							/>
							{noDestinations ? (
								<TextButtonRow title="Upload to S3" onPress={() => {}} disabled />
							) : (
								<MenuView
									actions={model.destinations.map((destination) => ({
										id: destination.id,
										title: destination.name
									}))}
									onPressAction={({ nativeEvent }) => model.upload(backup, nativeEvent.event)}
								>
									<View style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 }}>
										<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Upload to S3</Text>
									</View>
								</MenuView>
							)}
						</>
					) : null}
				</>
			) : null}
			{model.canBackup ? (
				<TextButtonRow
					title="Delete backup"
					destructive
					onPress={() => model.requestDelete(backup)}
					disabled={model.busy}
				/>
			) : null}
		</M3Section>
	);
}

export function VolumeBackupsScreen() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const model = useVolumeBackups(envID, name);
	const [refreshing, setRefreshing] = useState(false);

	return (
		<>
			<Stack.Screen options={{ title: 'Backups' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.refresh().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				{model.errorMessage !== undefined || model.warnings.length > 0 ? (
					<M3Section>
						{model.errorMessage !== undefined ? (
							<TextRow text={model.errorMessage} color={systemColors.red} />
						) : null}
						{model.warnings.map((warning) => (
							<TextRow key={warning} text={warning} color={systemColors.orange} />
						))}
					</M3Section>
				) : null}
				{model.canBackup ? (
					<>
						<M3Section>
							<TextButtonRow
								title="Create backup"
								onPress={model.openCreate}
								disabled={model.busy}
							/>
							{model.supportsPolicies ? (
								<LinkItem title="Backup policies" onPress={model.openPolicies} />
							) : null}
							{model.canUpload ? (
								<TextButtonRow
									title="Import and restore archive"
									onPress={model.pickImport}
									disabled={model.busy}
								/>
							) : null}
						</M3Section>
						{model.destinations.length > 0 ? (
							<M3Section
								title="Discover S3"
								footer="Import existing volume backups stored on the destination by this or other instances."
							>
								<FormPicker
									title="Destination"
									selection={model.discoverID}
									onSelectionChange={model.setDiscoverID}
									options={[
										{ label: 'Select', value: '' },
										...model.destinations.map((d) => ({ label: d.name, value: d.id }))
									]}
								/>
								<TextButtonRow
									title="Discover backups"
									onPress={model.discover}
									disabled={model.discoverID === '' || model.isDiscovering || model.busy}
								/>
							</M3Section>
						) : null}
					</>
				) : null}
				{model.downloadFile ? (
					<M3Section>
						<TextButtonRow title="Share downloaded backup" onPress={model.shareDownload} />
					</M3Section>
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
					<View style={{ padding: 16, alignItems: 'center' }}>
						<ArcaneLoadingView />
					</View>
				) : null}
			</ScrollView>
		</>
	);
}
