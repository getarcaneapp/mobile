/** Port of `SystemBackupsView` (SystemBackupsView.swift). */
import { Host } from '@/ui/host';
import { ContentUnavailableView, List, Section, Text, VStack } from '@expo/ui/swift-ui';
import {
	font,
	foregroundStyle,
	listRowBackground,
	listStyle,
	refreshable
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import { useAccentColor } from '@/theme/accent';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { PaginatedListFooter } from '@/ui/components/paginated-list';

import { useBackupNavigation } from './backup-routes';
import { AccentLabel, ErrorRetryRows, NavigationRow } from './backup-rows';
import { backupEntryDate, backupEntrySummary, useSystemBackups } from './use-system-backups';

export function SystemBackupsDestination() {
	const model = useSystemBackups();
	const nav = useBackupNavigation();
	const accent = useAccentColor();
	const { entries, busy, errorMessage, search } = model;

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Backups',
					headerSearchBarOptions: model.canRead
						? {
								onChangeText: (event) => model.setSearch(event.nativeEvent.text),
								onCancelButtonPress: () => model.setSearch('')
							}
						: undefined
				}}
			/>
			{model.canRead && model.supported ? (
				<AppToolbar placement="right" tintColor={accent}>
					<Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="Backup options">
						{model.canManage ? (
							<Stack.Toolbar.MenuAction icon="externaldrive.badge.plus" onPress={nav.openVolumeRun}>
								Back Up Volumes
							</Stack.Toolbar.MenuAction>
						) : null}
						<Stack.Toolbar.MenuAction icon="gearshape" onPress={nav.openSettings}>
							Backup Settings
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
					{model.canManage ? (
						<Stack.Toolbar.Button
							icon="plus"
							separateBackground
							accessibilityLabel="Create Backup"
							onPress={nav.openCreate}
						/>
					) : null}
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				{!model.canRead ? (
					<ContentUnavailableView title="Administrator Access Required" systemImage="lock" />
				) : (
					<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
						<ErrorRetryRows message={errorMessage} onRetry={() => void model.load()} />
						<Section title="History">
							{entries.map((entry) => (
								<NavigationRow key={entry.id} onPress={() => nav.openDetail(entry)}>
									<AccentLabel systemImage="externaldrive.badge.timemachine">
										<VStack alignment="leading">
											<Text>{entry.resourceName}</Text>
											<Text
												modifiers={[
													font({ textStyle: 'subheadline' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											>
												{backupEntryDate(entry)}
											</Text>
											<Text
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											>
												{backupEntrySummary(entry)}
											</Text>
										</VStack>
									</AccentLabel>
								</NavigationRow>
							))}
							<PaginatedListFooter
								key={entries.length}
								hasMore={model.hasMore}
								loadMoreError={model.loadMoreError}
								onRetry={model.loadMore}
								onLoadMore={model.loadMore}
							/>
							{busy && entries.length === 0 ? (
								<ArcaneLoadingViewSwiftUI label="Loading…" fillsWidth />
							) : null}
							{entries.length === 0 && !busy && errorMessage === undefined ? (
								<ContentUnavailableView
									title={search === '' ? 'No Backups' : 'No Matching Backups'}
									systemImage="externaldrive.badge.timemachine"
									description={
										search === '' ? 'Create a backup using the toolbar.' : 'Try a different search.'
									}
									modifiers={[listRowBackground('clear')]}
								/>
							) : null}
						</Section>
					</List>
				)}
			</Host>
		</>
	);
}
