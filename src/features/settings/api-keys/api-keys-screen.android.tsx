import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import type { SearchBarCommands } from 'react-native-screens';

import { withCleanup } from '@/core/with-cleanup';
import { SortOrder } from '@/sdk/models/base/pagination';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';

import { CenteredMessage } from '../shared/android-material';
import { AndroidToolbar, type AndroidToolbarItem } from '../shared/android-toolbar';
import { LongPressMenu } from '../shared/long-press-menu';
import { apiKeySortFields } from './api-key-models';
import { APIKeyRow } from './api-key-row';
import { useAPIKeys, type APIKeysModel } from './use-api-keys';

function APIKeysToolbar({ model }: { model: APIKeysModel }) {
	const items: AndroidToolbarItem[] = [
		{
			kind: 'menu',
			id: 'options',
			icon: 'ellipsis.circle',
			label: 'API key options',
			items: [
				...apiKeySortFields.map((field) => ({
					id: `sort-${field.value}`,
					title: field.title,
					checked: model.sortField === field.value,
					onPress: () => model.setSortField(field.value)
				})),
				{
					id: 'order-asc',
					title: 'Ascending',
					checked: model.sortOrder === SortOrder.ascending,
					onPress: () => model.setSortOrder(SortOrder.ascending)
				},
				{
					id: 'order-desc',
					title: 'Descending',
					checked: model.sortOrder === SortOrder.descending,
					onPress: () => model.setSortOrder(SortOrder.descending)
				}
			]
		}
	];
	if (model.access.canCreate) {
		items.push({
			kind: 'button',
			id: 'create',
			icon: 'plus',
			label: 'Create API Key',
			onPress: model.showCreateSheet
		});
	}
	return <AndroidToolbar items={items} />;
}

export function APIKeysDestination() {
	const model = useAPIKeys();
	const { apiKeys } = model;
	const [refreshing, setRefreshing] = useState(false);
	const searchBar = useRef<SearchBarCommands>(null);
	const clearSearch = () => {
		searchBar.current?.clearText();
		model.setSearchText('');
	};

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(
			async () => {
				await model.loadKeys();
			},
			() => setRefreshing(false)
		);
	};

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={() => void onRefresh()}
			colors={[systemColors.blue]}
		/>
	);

	let content;
	if (model.isLoading && apiKeys.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading API keys…" />
			</View>
		);
	} else if (model.errorMessage !== undefined && apiKeys.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load API Keys"
				message={model.errorMessage}
				action={{ title: 'Try Again', onPress: () => void model.loadKeys() }}
			/>
		);
	} else if (apiKeys.length === 0 && model.debouncedSearchText !== '') {
		content = (
			<CenteredMessage
				icon="magnifyingglass"
				title="No Results"
				message={`No API keys match “${model.debouncedSearchText}”.`}
				action={{ title: 'Clear Search', onPress: clearSearch }}
			/>
		);
	} else if (apiKeys.length === 0) {
		content = (
			<CenteredMessage
				icon="key.slash"
				title="No API Keys"
				message="Create a key to access the Arcane API from scripts and integrations."
				action={
					model.access.canCreate
						? { title: 'Create API Key', onPress: model.showCreateSheet }
						: undefined
				}
			/>
		);
	} else {
		content = (
			<GroupedFlashList
				data={apiKeys.map((apiKey, index) => ({
					key: apiKey.id,
					type: 'apiKey',
					apiKey,
					grouped: groupPosition(index, apiKeys.length)
				}))}
				renderEntry={({ apiKey, grouped }) => (
					<>
						{grouped.isFirst ? null : (
							<View style={{ height: 0.5, marginLeft: 64, backgroundColor: colors.separator }} />
						)}
						<LongPressMenu
							title={apiKey.name}
							onPress={() => model.openDetail(apiKey)}
							items={[
								{
									id: 'copy',
									title: 'Copy Key Prefix',
									onPress: () => model.copyPrefix(apiKey)
								}
							]}
							style={{ paddingHorizontal: 16, paddingVertical: 12 }}
						>
							<APIKeyRow apiKey={apiKey} assignedUser={model.assignedUser(apiKey)} />
						</LongPressMenu>
					</>
				)}
				header={
					<View style={{ paddingHorizontal: 16 }}>
						<ResourceCountSectionHeader
							title="API Keys"
							loadedCount={apiKeys.length}
							totalCount={model.pagination.totalItems}
							hasMore={model.pagination.hasMore}
						/>
					</View>
				}
				footer={
					<PaginatedListFooter
						hasMore={model.pagination.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				}
				onEndReached={
					model.pagination.hasMore && model.loadMoreError === undefined
						? () => void model.loadMore()
						: undefined
				}
				refreshControl={refreshControl}
			/>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'API Keys',
					headerSearchBarOptions: {
						ref: searchBar,
						placeholder: 'Search API keys',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<APIKeysToolbar model={model} />
			{apiKeys.length > 0 ? (
				content
			) : (
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
					keyboardShouldPersistTaps="handled"
					refreshControl={refreshControl}
				>
					{content}
				</ScrollView>
			)}
		</>
	);
}
