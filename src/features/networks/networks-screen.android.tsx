import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	EnvironmentLabel,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { environmentTitle } from '@/ui/components/environment-label.types';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { SectionTitle } from './android-parts';

import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';
import { CenteredMessage } from '@/features/containers/android-material';
import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { LongPressMenu } from '@/features/containers/long-press-menu';

import { networkContainerCount, networkIsInternal, type NetworkItem } from './network-model';
import {
	useNetworksList,
	type NetworksListModel,
	type NetworksListProps
} from './use-networks-list';

export function NetworkRow({
	network,
	environmentName,
	environmentColor
}: {
	network: NetworkItem['value'];
	environmentName?: string;
	environmentColor?: string;
}) {
	const count = networkContainerCount(network);
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
			<RowIcon systemImage="network" tint={systemColors.teal} />
			<View style={{ flex: 1, gap: 4 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{network.name}</Text>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						{network.driver}
					</Text>
					{networkIsInternal(network) ? (
						<Text style={[m3Type.bodyMedium, { color: systemColors.orange }]}>• Internal</Text>
					) : null}
					{count > 0 ? (
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
							<Icon name="cube.box.fill" size={14} color={systemColors.teal} />
							<Text style={[m3Type.bodyMedium, { color: systemColors.teal }]}>{String(count)}</Text>
						</View>
					) : null}
				</View>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</View>
		</View>
	);
}

function NetworkListRow({
	model,
	network,
	deletable
}: {
	model: NetworksListModel;
	network: NetworkItem;
	deletable: boolean;
}) {
	const environmentColor = useEnvironmentRowColor(network.environmentID, network.environmentName);
	return (
		<LongPressMenu
			title={network.value.name}
			items={
				deletable
					? [
							{
								id: 'delete',
								title: 'Delete',
								destructive: true,
								onPress: () => model.requestDelete(network)
							}
						]
					: []
			}
			onPress={() => model.openDetail(network)}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<NetworkRow
				network={network.value}
				environmentName={network.environmentName}
				environmentColor={environmentColor}
			/>
		</LongPressMenu>
	);
}

function NetworksToolbar({ model }: { model: NetworksListModel }) {
	const environments = model.listEnvironments;
	const createIsMenu =
		model.allEnvironments && (environments.length > 1 || environments[0]?.name !== undefined);
	const items: AndroidToolbarItem[] = [
		{
			kind: 'button',
			id: 'filter',
			icon:
				model.activeFilterCount > 0
					? 'line.3.horizontal.decrease.circle.fill'
					: 'line.3.horizontal.decrease.circle',
			label: 'Filter',
			onPress: model.openFilter
		},
		createIsMenu
			? {
					kind: 'menu',
					id: 'create',
					icon: 'plus',
					label: 'Create network',
					items: environments.map((environment) => ({
						id: environment.id,
						title: environmentTitle(environment),
						onPress: () => model.presentCreateSheet(environment.id)
					}))
				}
			: {
					kind: 'button',
					id: 'create',
					icon: 'plus',
					label: 'Create network',
					onPress: () => model.presentCreateSheet(environments[0]?.id ?? model.environmentID)
				},
		{
			kind: 'button',
			id: 'prune',
			icon: 'trash',
			label: 'Prune unused networks',
			color: systemColors.red,
			disabled: model.allEnvironments && model.isOperationRunning,
			onPress: model.requestPrune
		}
	];
	return <AndroidToolbar items={items} />;
}

export function NetworksScreen(props: NetworksListProps) {
	const model = useNetworksList(props);
	const { snapshot, networks, systemNetworks, userNetworks } = model;
	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await model.refresh();
		} finally {
			setRefreshing(false);
		}
	};

	const count = (
		<ResourceCountLabel
			loadedCount={networks.length}
			totalCount={snapshot.totalItems}
			hasMore={snapshot.hasMore}
		/>
	);
	let content;
	if (snapshot.isLoading && networks.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && networks.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Networks"
				message={snapshot.errorMessage}
				action={{ title: 'Retry', onPress: () => void model.loadNetworks() }}
			/>
		);
	} else if (networks.length === 0) {
		const first = model.listEnvironments[0];
		content = (
			<CenteredMessage
				icon="network"
				title="No Networks"
				message={
					props.allEnvironments
						? 'No networks found in any environment.'
						: 'No networks found in this environment.'
				}
				action={
					!props.allEnvironments || (model.listEnvironments.length === 1 && first)
						? {
								title: 'Create Network',
								onPress: () => model.presentCreateSheet(first?.id ?? props.environmentID)
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
					retry={() => void model.loadNetworks()}
				/>
				{systemNetworks.length > 0 ? (
					<View>
						<SectionTitle title="Built-in" trailing={count} />
						<MaterialListGroup>
							{systemNetworks.map((network) => (
								<NetworkListRow
									key={network.id}
									model={model}
									network={network}
									deletable={false}
								/>
							))}
						</MaterialListGroup>
						<Text
							style={[
								m3Type.bodySmall,
								{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
							]}
						>
							Built-in Docker networks can't be removed.
						</Text>
					</View>
				) : null}
				{userNetworks.length > 0 ? (
					<View>
						<SectionTitle
							title="Custom"
							trailing={systemNetworks.length === 0 ? count : undefined}
						/>
						<MaterialListGroup>
							{userNetworks.map((network) => (
								<NetworkListRow key={network.id} model={model} network={network} deletable />
							))}
						</MaterialListGroup>
					</View>
				) : null}
				<PaginatedListFooter
					hasMore={snapshot.hasMore}
					loadMoreError={snapshot.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Networks',
					headerSearchBarOptions: {
						placeholder: 'Search networks',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<NetworksToolbar model={model} />
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
