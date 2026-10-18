import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import { useEnvironmentRowColor } from '@/features/containers/hooks';
import {
	AndroidToolbar,
	type AndroidToolbarItem
} from '@/features/settings/shared/android-toolbar';
import { CenteredMessage } from '@/features/settings/shared/android-material';
import { LongPressMenu, type RowMenuItem } from '@/features/settings/shared/long-press-menu';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	EnvironmentLabel,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { environmentActionIsMenu, environmentTitle } from '@/ui/components/environment-label.types';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { DynamicResource } from './dynamic-resource';
import {
	useDynamicResourceList,
	type DynamicResourceItem,
	type DynamicResourceListConfig,
	type DynamicResourceListModel,
	type PendingAction
} from './use-dynamic-resource-list';

export function confirmBackendAction(
	model: Pick<DynamicResourceListModel, 'run'>,
	pending: PendingAction
) {
	const message = pending.item
		? `${pending.action.title} ${DynamicResource.title(pending.item.value)}?`
		: `${pending.action.title}?`;
	Alert.alert(pending.action.title, message, [
		{ text: 'Cancel', style: 'cancel' },
		{
			text: pending.action.title,
			style: pending.action.destructive ? 'destructive' : 'default',
			onPress: () => void model.run(pending)
		}
	]);
}

export function DynamicResourceRow({
	item,
	systemImage,
	environmentName,
	environmentColor
}: {
	item: DynamicResource;
	systemImage: string;
	environmentName?: string;
	environmentColor?: string;
}) {
	const status = DynamicResource.statusText(item);
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
			<RowIcon systemImage={systemImage} />
			<View style={{ flex: 1, gap: 3 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>
					{DynamicResource.title(item)}
				</Text>
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
					{DynamicResource.subtitle(item)}
				</Text>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</View>
			{status !== undefined ? (
				<Text style={[m3Type.labelMedium, { color: colors.secondaryLabel }]}>{status}</Text>
			) : null}
		</View>
	);
}

function ResourceRow({
	model,
	item
}: {
	model: DynamicResourceListModel;
	item: DynamicResourceItem;
}) {
	const environmentColor = useEnvironmentRowColor(item.environmentID, item.environmentName);
	const menu: RowMenuItem[] = [];
	if (model.canEdit)
		menu.push({ id: 'edit', title: 'Edit', onPress: () => model.presentEdit(item) });
	for (const action of model.rowActions) {
		menu.push({
			id: action.id,
			title: action.title,
			destructive: action.destructive,
			onPress: () => confirmBackendAction(model, { action, item })
		});
	}
	return (
		<LongPressMenu
			items={menu}
			title={DynamicResource.title(item.value)}
			onPress={() => model.openDetail(item)}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<DynamicResourceRow
				item={item.value}
				systemImage={model.systemImage}
				environmentName={item.environmentName}
				environmentColor={environmentColor}
			/>
			<Icon name="chevron.right" size={18} color={colors.tertiaryLabel} />
		</LongPressMenu>
	);
}

function toolbarItems(model: DynamicResourceListModel): AndroidToolbarItem[] {
	const items: AndroidToolbarItem[] = [
		{
			kind: 'button',
			id: 'refresh',
			icon: 'arrow.clockwise',
			label: 'Refresh',
			onPress: () => void model.load()
		}
	];
	if (model.managementTitle) {
		items.push({
			kind: 'button',
			id: 'manage',
			icon: 'gearshape',
			label: model.managementTitle,
			onPress: model.openManagement
		});
	}
	if (model.canCreate) {
		const environments = model.listEnvironments;
		items.push(
			model.showsAllEnvironments && environmentActionIsMenu(environments)
				? {
						kind: 'menu',
						id: 'create',
						icon: 'plus',
						label: model.createTitle,
						items: environments.map((environment) => ({
							id: environment.id,
							title: environmentTitle(environment),
							onPress: () => model.presentCreate(environment.id)
						}))
					}
				: {
						kind: 'button',
						id: 'create',
						icon: 'plus',
						label: model.createTitle,
						onPress: () =>
							model.presentCreate(model.showsAllEnvironments ? environments[0]?.id : undefined)
					}
		);
	}
	if (model.globalActions.length > 0) {
		items.push({
			kind: 'menu',
			id: 'options',
			icon: 'ellipsis.circle',
			label: 'More options',
			items: model.globalActions.map((action) => ({
				id: action.id,
				title: action.title,
				destructive: action.destructive,
				onPress: () => confirmBackendAction(model, { action })
			}))
		});
	}
	return items;
}

export function DynamicResourceListView(config: DynamicResourceListConfig) {
	const model = useDynamicResourceList(config);
	const { snapshot, items } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(
			() => model.load(),
			() => setRefreshing(false)
		);
	};

	let content;
	if (snapshot.isLoading && items.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && items.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title={`Couldn't Load ${model.title}`}
				message={snapshot.errorMessage}
				action={{ title: 'Try Again', onPress: () => void model.load() }}
			/>
		);
	} else if (items.length === 0 && model.searchText.trim() !== '') {
		content = (
			<CenteredMessage
				icon="magnifyingglass"
				title={`No Results for “${model.searchText.trim()}”`}
				message="Check the spelling or try a new search."
			/>
		);
	} else if (items.length === 0) {
		const createsDirectly =
			model.canCreate &&
			!(model.showsAllEnvironments && environmentActionIsMenu(model.listEnvironments));
		content = (
			<CenteredMessage
				icon={model.systemImage}
				title={model.emptyTitle}
				message=""
				action={
					createsDirectly
						? {
								title: model.createTitle,
								onPress: () =>
									model.presentCreate(
										model.showsAllEnvironments ? model.listEnvironments[0]?.id : undefined
									)
							}
						: undefined
				}
			/>
		);
	} else {
		content = (
			<>
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.load()}
				/>
				{model.actionMessage !== undefined ? (
					<View style={{ paddingTop: 12 }}>
						<MaterialListGroup>
							<View
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 12,
									minHeight: 48,
									paddingHorizontal: 16
								}}
							>
								<Icon name="checkmark.circle" size={20} color={systemColors.green} />
								<Text style={[m3Type.bodyLarge, { color: systemColors.green, flex: 1 }]}>
									{model.actionMessage}
								</Text>
							</View>
						</MaterialListGroup>
					</View>
				) : null}
				<ResourceCountSectionHeader
					title={model.title}
					loadedCount={items.length}
					totalCount={snapshot.totalItems}
					hasMore={snapshot.hasMore}
				/>
				<MaterialListGroup>
					{model.displayedItems.map((item) => (
						<ResourceRow key={item.id} model={model} item={item} />
					))}
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				</MaterialListGroup>
			</>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: model.title,
					headerSearchBarOptions: {
						placeholder: `Search ${model.title.toLowerCase()}`,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<AndroidToolbar items={toolbarItems(model)} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{content}
			</ScrollView>
		</>
	);
}
