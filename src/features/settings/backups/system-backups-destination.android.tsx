import { Stack } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useState } from 'react';

import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { MaterialListGroup, MaterialListItem, MaterialSectionHeader } from '@/ui/material/list';
import { Icon } from '@/ui/Icon';

import { AndroidToolbar, type AndroidToolbarItem } from '../shared/android-toolbar';
import { CenteredMessage } from '../shared/android-material';
import { useBackupNavigation } from './backup-routes';
import { AndroidErrorRetry } from './backup-android';
import { backupEntryDate, backupEntrySummary, useSystemBackups } from './use-system-backups';

export function SystemBackupsDestination() {
	const model = useSystemBackups();
	const nav = useBackupNavigation();
	const [refreshing, setRefreshing] = useState(false);
	const { entries, busy, errorMessage, search } = model;

	const toolbarItems: AndroidToolbarItem[] = [];
	if (model.canRead && model.supported) {
		if (model.canManage) {
			toolbarItems.push({
				kind: 'button',
				id: 'create',
				icon: 'plus',
				label: 'Create Backup',
				onPress: nav.openCreate
			});
		}
		toolbarItems.push({
			kind: 'menu',
			id: 'options',
			icon: 'ellipsis.circle',
			label: 'Backup options',
			items: [
				...(model.canManage
					? [{ id: 'volumes', title: 'Back Up Volumes', onPress: nav.openVolumeRun }]
					: []),
				{ id: 'settings', title: 'Backup Settings', onPress: nav.openSettings }
			]
		});
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Backups',
					headerSearchBarOptions: model.canRead
						? {
								onChangeText: (event) => model.setSearch(event.nativeEvent.text),
								onClose: () => model.setSearch('')
							}
						: undefined
				}}
			/>
			{toolbarItems.length > 0 ? <AndroidToolbar items={toolbarItems} /> : null}
			{!model.canRead ? (
				<CenteredMessage icon="lock" title="Administrator Access Required" message="" />
			) : (
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
					<AndroidErrorRetry message={errorMessage} onRetry={() => void model.load()} />
					<MaterialSectionHeader title="History" />
					<MaterialListGroup>
						{entries.map((entry) => (
							<MaterialListItem
								key={entry.id}
								headline={entry.resourceName}
								supporting={`${backupEntryDate(entry)}\n${backupEntrySummary(entry)}`}
								icon="externaldrive.badge.timemachine"
								trailing={<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />}
								onPress={() => nav.openDetail(entry)}
							/>
						))}
						<PaginatedListFooter
							key={entries.length}
							hasMore={model.hasMore}
							loadMoreError={model.loadMoreError}
							onRetry={model.loadMore}
							onLoadMore={model.loadMore}
						/>
						{busy && entries.length === 0 ? (
							<View style={{ padding: 24, alignItems: 'center' }}>
								<ArcaneLoadingView label="Loading…" />
							</View>
						) : null}
					</MaterialListGroup>
					{entries.length === 0 && !busy && errorMessage === undefined ? (
						<CenteredMessage
							icon="externaldrive.badge.timemachine"
							title={search === '' ? 'No Backups' : 'No Matching Backups'}
							message={
								search === '' ? 'Create a backup using the toolbar.' : 'Try a different search.'
							}
						/>
					) : null}
				</ScrollView>
			)}
		</>
	);
}
