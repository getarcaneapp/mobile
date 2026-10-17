import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContextMenu,
	HStack,
	List,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	font,
	foregroundStyle,
	frame,
	listStyle,
	refreshable,
	tint,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import {
	EnvironmentActionButton,
	EnvironmentLabel,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { RowPreviewCard } from '@/ui/components/row-preview-card';
import { environmentTitle } from '@/ui/components/environment-label.types';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { useEnvironmentRowColor } from '@/features/containers/hooks';

import {
	networkContainerCount,
	networkIsInternal,
	networkPreview,
	type NetworkItem
} from './network-model';
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
		<HStack spacing={12}>
			<RowIcon systemImage="network" tint={systemColors.teal} />
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'body' })]}>{network.name}</Text>
				<HStack spacing={8}>
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{network.driver}
					</Text>
					{networkIsInternal(network) ? (
						<Text
							modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(systemColors.orange)]}
						>
							• Internal
						</Text>
					) : null}
					{count > 0 ? (
						<HStack
							spacing={3}
							modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(systemColors.teal)]}
						>
							<Image systemName="cube.box.fill" />
							<Text>{String(count)}</Text>
						</HStack>
					) : null}
				</HStack>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</VStack>
			<Spacer minLength={0} />
		</HStack>
	);
}

function NetworkPreview({ network }: { network: NetworkItem }) {
	const preview = networkPreview(network);
	return (
		<RowPreviewCard
			icon="network"
			iconColor={systemColors.teal}
			title={preview.title}
			badges={preview.badges}
			details={preview.details}
		/>
	);
}

function NetworkLink({
	model,
	network,
	deletable
}: {
	model: NetworksListModel;
	network: NetworkItem;
	deletable: boolean;
}) {
	const environmentColor = useEnvironmentRowColor(network.environmentID, network.environmentName);
	const link = (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button
					onPress={() => model.openDetail(network)}
					modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
				>
					<HStack>
						<NetworkRow
							network={network.value}
							environmentName={network.environmentName}
							environmentColor={environmentColor}
						/>
						<DisclosureChevron />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				{deletable ? (
					<Button
						role="destructive"
						onPress={() => model.requestDelete(network)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Delete" />
					</Button>
				) : null}
			</ContextMenu.Items>
			<ContextMenu.Preview>
				<NetworkPreview network={network} />
			</ContextMenu.Preview>
		</ContextMenu>
	);
	if (!deletable) return link;
	return (
		<SwipeActions>
			{link}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Delete"
					systemImage="trash"
					onPress={() => model.requestDelete(network)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

function NetworksToolbar({ model }: { model: NetworksListModel }) {
	const accent = useAccentColor();
	const filterIcon =
		model.activeFilterCount > 0
			? 'line.3.horizontal.decrease.circle.fill'
			: 'line.3.horizontal.decrease.circle';
	const icon = useToolbarIcons([filterIcon, 'plus', 'trash']);
	const environments = model.listEnvironments;
	const createIsMenu =
		model.allEnvironments && (environments.length > 1 || environments[0]?.name !== undefined);
	return (
		<AppToolbar placement="right" tintColor={accent}>
			<Stack.Toolbar.Button
				icon={icon(filterIcon)}
				separateBackground
				accessibilityLabel="Filter"
				onPress={model.openFilter}
			/>
			{createIsMenu ? (
				<Stack.Toolbar.Menu icon={icon('plus')} accessibilityLabel="Create network">
					{environments.map((environment) => (
						<Stack.Toolbar.MenuAction
							key={environment.id}
							onPress={() => model.presentCreateSheet(environment.id)}
						>
							{environmentTitle(environment)}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			) : (
				<Stack.Toolbar.Button
					icon={icon('plus')}
					accessibilityLabel="Create network"
					onPress={() => model.presentCreateSheet(environments[0]?.id ?? model.environmentID)}
				/>
			)}
			<Stack.Toolbar.Button
				icon={icon('trash')}
				tintColor={systemColors.red}
				accessibilityLabel="Prune unused networks"
				disabled={model.allEnvironments && model.isOperationRunning}
				onPress={model.requestPrune}
			/>
		</AppToolbar>
	);
}

export function NetworksScreen(props: NetworksListProps) {
	const model = useNetworksList(props);
	const { snapshot, networks, systemNetworks, userNetworks } = model;

	let content;
	if (snapshot.isLoading && networks.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && networks.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Networks"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
				actions={[{ title: 'Retry', onPress: () => void model.loadNetworks() }]}
			/>
		);
	} else if (networks.length === 0) {
		content = (
			<UnavailableView
				title="No Networks"
				systemImage="network"
				description={
					props.allEnvironments
						? 'No networks found in any environment.'
						: 'No networks found in this environment.'
				}
			>
				{props.allEnvironments ? (
					<EnvironmentActionButton
						title="Create Network"
						systemImage="plus"
						environments={model.listEnvironments}
						action={model.presentCreateSheet}
					/>
				) : (
					<Button
						label="Create Network"
						onPress={() => model.presentCreateSheet(props.environmentID)}
					/>
				)}
			</UnavailableView>
		);
	} else {
		const countHeader = (title: string) => (
			<ResourceCountSectionHeader
				title={title}
				loadedCount={networks.length}
				totalCount={snapshot.totalItems}
				hasMore={snapshot.hasMore}
			/>
		);
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.loadNetworks()}
				/>
				{systemNetworks.length > 0 ? (
					<Section
						header={countHeader('Built-in')}
						footer={<Text>Built-in Docker networks can't be removed.</Text>}
					>
						{systemNetworks.map((network) => (
							<NetworkLink key={network.id} model={model} network={network} deletable={false} />
						))}
					</Section>
				) : null}
				{userNetworks.length > 0 ? (
					<Section
						header={systemNetworks.length === 0 ? countHeader('Custom') : <Text>Custom</Text>}
					>
						{userNetworks.map((network) => (
							<NetworkLink key={network.id} model={model} network={network} deletable />
						))}
					</Section>
				) : null}
				<PaginatedListFooter
					hasMore={snapshot.hasMore}
					loadMoreError={snapshot.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Networks',
					headerSearchBarOptions: {
						placeholder: 'Search networks',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<NetworksToolbar model={model} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
