/** Port of `APIKeysView` (APIKeysView.swift). */
import { Host } from '@/ui/host';
import { Button, ContextMenu, HStack, List, Section, VStack } from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	frame,
	listStyle,
	refreshable,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useRef } from 'react';
import type { SearchBarCommands } from 'react-native-screens';

import type { APIKey } from '@/sdk/models/apiKey/APIKey';
import { SortOrder } from '@/sdk/models/base/pagination';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowPreviewCard } from '@/ui/components/row-preview-card';
import { AppToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

import { ContentUnavailableWithActions } from '../shared/content-unavailable-actions';
import {
	APIKeyDateText,
	APIKeyOwnerText,
	apiKeyIsExpired,
	apiKeySortFields
} from './api-key-models';
import { APIKeyRow } from './api-key-row';
import { useAPIKeys, type APIKeysModel } from './use-api-keys';

function APIKeysToolbar({ model }: { model: APIKeysModel }) {
	return (
		<AppToolbar>
			<Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="API key options">
				<Stack.Toolbar.Menu inline title="Sort By">
					{apiKeySortFields.map((field) => (
						<Stack.Toolbar.MenuAction
							key={field.value}
							isOn={model.sortField === field.value}
							onPress={() => model.setSortField(field.value)}
						>
							{field.title}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
				<Stack.Toolbar.Menu inline title="Order">
					<Stack.Toolbar.MenuAction
						icon="arrow.up"
						isOn={model.sortOrder === SortOrder.ascending}
						onPress={() => model.setSortOrder(SortOrder.ascending)}
					>
						Ascending
					</Stack.Toolbar.MenuAction>
					<Stack.Toolbar.MenuAction
						icon="arrow.down"
						isOn={model.sortOrder === SortOrder.descending}
						onPress={() => model.setSortOrder(SortOrder.descending)}
					>
						Descending
					</Stack.Toolbar.MenuAction>
				</Stack.Toolbar.Menu>
			</Stack.Toolbar.Menu>
			{model.access.canCreate ? (
				<Stack.Toolbar.Button
					icon="plus"
					separateBackground
					accessibilityLabel="Create API Key"
					onPress={model.showCreateSheet}
				/>
			) : null}
		</AppToolbar>
	);
}

function KeyLink({ model, apiKey }: { model: APIKeysModel; apiKey: APIKey }) {
	const user = model.assignedUser(apiKey);
	const expired = apiKeyIsExpired(apiKey);
	return (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button onPress={() => model.openDetail(apiKey)} modifiers={[buttonStyle('plain')]}>
					<HStack modifiers={[contentShape(shapes.rectangle())]}>
						<APIKeyRow apiKey={apiKey} assignedUser={user} />
						<DisclosureChevron />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				<Button
					label="Copy Key Prefix"
					systemImage="doc.on.doc"
					onPress={() => model.copyPrefix(apiKey)}
				/>
			</ContextMenu.Items>
			<ContextMenu.Preview>
				<RowPreviewCard
					icon="key.fill"
					iconColor={systemColors.yellow}
					title={apiKey.name}
					subtitle={apiKey.description}
					badges={[
						{
							text: expired ? 'Expired' : 'Active',
							color: expired ? systemColors.red : systemColors.green
						}
					]}
					details={[
						{
							icon: 'number',
							label: 'Key Prefix',
							value: `${apiKey.keyPrefix}…`,
							monospaced: true
						},
						{
							icon: 'person.fill',
							label: 'Assigned To',
							value: APIKeyOwnerText.title(user, apiKey.userId)
						},
						{
							icon: 'calendar',
							label: 'Expires',
							value: APIKeyDateText.expiration(apiKey.expiresAt)
						}
					]}
				/>
			</ContextMenu.Preview>
		</ContextMenu>
	);
}

export function APIKeysDestination() {
	const model = useAPIKeys();
	const { apiKeys } = model;
	const searchBar = useRef<SearchBarCommands>(null);
	const clearSearch = () => {
		searchBar.current?.clearText();
		model.setSearchText('');
	};

	let content;
	if (model.isLoading && apiKeys.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading API keys…" />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && apiKeys.length === 0) {
		content = (
			<ContentUnavailableWithActions
				title="Couldn't Load API Keys"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.loadKeys() }]}
			/>
		);
	} else if (apiKeys.length === 0 && model.debouncedSearchText !== '') {
		content = (
			<ContentUnavailableWithActions
				title="No Results"
				systemImage="magnifyingglass"
				description={`No API keys match “${model.debouncedSearchText}”.`}
				actions={[{ title: 'Clear Search', onPress: clearSearch }]}
			/>
		);
	} else if (apiKeys.length === 0) {
		content = (
			<ContentUnavailableWithActions
				title="No API Keys"
				systemImage="key.slash"
				description="Create a key to access the Arcane API from scripts and integrations."
				actions={
					model.access.canCreate
						? [{ title: 'Create API Key', onPress: model.showCreateSheet }]
						: []
				}
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.loadKeys)]}>
				<Section
					header={
						<ResourceCountSectionHeader
							title="API Keys"
							loadedCount={apiKeys.length}
							totalCount={model.pagination.totalItems}
							hasMore={model.pagination.hasMore}
						/>
					}
				>
					{apiKeys.map((apiKey) => (
						<KeyLink key={apiKey.id} model={model} apiKey={apiKey} />
					))}
					<PaginatedListFooter
						hasMore={model.pagination.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				</Section>
			</List>
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
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<APIKeysToolbar model={model} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
