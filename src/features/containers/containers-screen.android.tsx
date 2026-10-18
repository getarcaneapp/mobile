import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { EnvironmentLoadFailuresSection } from '@/ui/components/environment-label';
import { ResourceCountLabel } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { VirtualizedSectionedList } from '@/ui/components/virtualized-sectioned-list';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { containerDisplayName, containerIsRunning } from './container-model';
import { ContainerRow } from './container-row';
import { ContainersToolbar } from './containers-toolbar';
import { useEnvironmentRowColor } from './hooks';
import { LongPressMenu, type RowMenuItem } from './long-press-menu';
import {
	useContainerRowMetrics,
	useContainersList,
	type ContainerItem,
	type ContainersListModel,
	type ContainersListProps
} from './use-containers-list';
import { sectionItemCount, spansSections } from '@/ui/components/stable-sectioned-list.types';

function rowMenuItems(
	model: ContainersListModel,
	item: ContainerItem,
	isPinned: boolean
): RowMenuItem[] {
	const running = containerIsRunning(item.value);
	const items: RowMenuItem[] = [
		{ id: 'pin', title: isPinned ? 'Unpin' : 'Pin', onPress: () => model.togglePin(item) }
	];
	if (model.canUpdate(item))
		items.push({ id: 'update', title: 'Update', onPress: () => model.updateContainer(item) });
	items.push({ id: 'logs', title: 'Logs', onPress: () => model.openLogs(item) });
	if (running) {
		items.push({ id: 'terminal', title: 'Terminal', onPress: () => model.openTerminal(item) });
		items.push({
			id: 'stop',
			title: 'Stop',
			destructive: true,
			onPress: () => model.stopContainer(item)
		});
		items.push({ id: 'restart', title: 'Restart', onPress: () => model.restartContainer(item) });
		if (model.canKill(item))
			items.push({
				id: 'kill',
				title: 'Kill',
				destructive: true,
				onPress: () => model.requestKill(item)
			});
	} else {
		items.push({ id: 'start', title: 'Start', onPress: () => model.startContainer(item) });
		items.push({
			id: 'remove',
			title: 'Remove',
			destructive: true,
			onPress: () => model.requestRemove(item)
		});
	}
	return items;
}

function Checkbox({ checked }: { checked: boolean }) {
	return (
		<View
			style={{
				width: 20,
				height: 20,
				borderRadius: 2,
				borderWidth: 2,
				borderColor: checked ? m3.primary : m3.onSurfaceVariant,
				backgroundColor: checked ? m3.primary : 'transparent',
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			{checked ? <Icon name="checkmark" size={14} color={m3.onPrimary} /> : null}
		</View>
	);
}

const rowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	paddingHorizontal: 16,
	paddingVertical: 10
};

function ContainerListRow({ model, item }: { model: ContainersListModel; item: ContainerItem }) {
	const isPinned = model.pinnedIDs.has(item.id);
	const environmentColor = useEnvironmentRowColor(item.environmentID, item.environmentName);
	const metrics = useContainerRowMetrics(model.samples, item);
	const row = (
		<ContainerRow
			container={item.value}
			isPinned={isPinned}
			environmentName={item.environmentName}
			environmentColor={environmentColor}
			metrics={metrics}
		/>
	);
	if (model.isSelecting) {
		const selected = model.selection.includes(item.id);
		return (
			<Pressable
				onPress={() => model.toggleSelected(item.id)}
				accessibilityRole="checkbox"
				accessibilityState={{ checked: selected }}
				android_ripple={{ color: colors.separator as string }}
				style={rowStyle}
			>
				<Checkbox checked={selected} />
				<View style={{ flex: 1 }}>{row}</View>
			</Pressable>
		);
	}
	return (
		<LongPressMenu
			items={rowMenuItems(model, item, isPinned)}
			title={containerDisplayName(item.value)}
			onPress={() => model.openDetail(item)}
			style={rowStyle}
		>
			<View style={{ flex: 1 }}>{row}</View>
		</LongPressMenu>
	);
}

function EmptyState({
	icon,
	title,
	message,
	action
}: {
	icon: string;
	title: string;
	message: string;
	action?: { title: string; onPress: () => void };
}) {
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
			<Icon name={icon} size={44} color={colors.secondaryLabel} />
			<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
				{message}
			</Text>
			{action ? (
				<Pressable
					onPress={action.onPress}
					accessibilityRole="button"
					style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 10 }}
				>
					<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{action.title}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

export function ContainersScreen(props: ContainersListProps) {
	const model = useContainersList(props);
	const { snapshot, containers } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(model.refresh, () => setRefreshing(false));
	};

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={() => void onRefresh()}
			colors={[systemColors.blue]}
		/>
	);

	const visibleCount = sectionItemCount(model.sections);
	const isFiltered = visibleCount < containers.length;
	let content;
	if (snapshot.isLoading && containers.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && containers.length === 0) {
		content = (
			<EmptyState icon="exclamationmark.triangle" title="Error" message={snapshot.errorMessage} />
		);
	} else if (containers.length === 0 && model.searchText.trim() === '') {
		content = (
			<EmptyState
				icon="cube.box"
				title="No Containers"
				message={
					props.allEnvironments
						? 'No containers found in any environment.'
						: 'No containers found in this environment.'
				}
				action={{ title: 'Refresh', onPress: () => void model.loadContainers() }}
			/>
		);
	} else if (visibleCount === 0 && !snapshot.hasMore) {
		content = (
			<EmptyState
				icon="magnifyingglass"
				title="No Results"
				message="Nothing matches the current search or filter."
			/>
		);
	}

	const list =
		content === undefined ? (
			<VirtualizedSectionedList
				onEndReached={
					snapshot.hasMore && snapshot.loadMoreError === undefined
						? () => void model.loadMore()
						: undefined
				}
				sections={model.sections}
				preferredHeaderAccessorySectionID="running"
				headerAccessory={() => (
					<ResourceCountLabel
						spansSections={spansSections(model.sections)}
						loadedCount={isFiltered ? visibleCount : containers.length}
						totalCount={isFiltered ? undefined : snapshot.totalItems}
						hasMore={!isFiltered && snapshot.hasMore}
					/>
				)}
				renderRow={(item) => <ContainerListRow model={model} item={item} />}
				header={
					<EnvironmentLoadFailuresSection
						failures={snapshot.failedEnvironments.map((failure) => ({
							...failure,
							id: failure.environment.id
						}))}
						retry={() => void model.loadContainers()}
					/>
				}
				footer={
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				}
				refreshControl={refreshControl}
			/>
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
		);

	return (
		<>
			<Stack.Screen
				options={{
					title: model.isSelecting ? `${model.selection.length} selected` : 'Containers',
					headerSearchBarOptions: {
						placeholder: 'Search containers',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<ContainersToolbar model={model} />
			{list}
		</>
	);
}
