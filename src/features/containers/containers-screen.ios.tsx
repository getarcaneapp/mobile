import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	HStack,
	List,
	SwipeActions,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	environment,
	frame,
	listStyle,
	refreshable,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemColors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { EnvironmentLoadFailuresSection } from '@/ui/components/environment-label';
import { DestructiveLabel, ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowPreviewCard } from '@/ui/components/row-preview-card';
import { StableSectionedList } from '@/ui/components/stable-sectioned-list';
import { DisclosureChevron } from '@/ui/settings-row';

import {
	containerDisplayName,
	containerIsRunning,
	themedIconUrl,
	trimSlashes
} from './container-model';
import { ContainerRow } from './container-row';
import { useEnvironmentRowColor } from './hooks';
import { ContainersToolbar } from './containers-toolbar';
import {
	useContainerRowMetrics,
	useContainersList,
	type ContainerItem,
	type ContainersListModel,
	type ContainersListProps
} from './use-containers-list';

function ContainerMenuActions({
	model,
	item
}: {
	model: ContainersListModel;
	item: ContainerItem;
}) {
	const running = containerIsRunning(item.value);
	return (
		<>
			{model.canUpdate(item) ? (
				<Button
					label="Update"
					systemImage="arrow.up.circle.fill"
					onPress={() => model.updateContainer(item)}
				/>
			) : null}
			<Button label="Logs" systemImage="text.alignleft" onPress={() => model.openLogs(item)} />
			{running ? (
				<Button label="Terminal" systemImage="terminal" onPress={() => model.openTerminal(item)} />
			) : null}
			{running ? (
				<>
					<Button
						role="destructive"
						onPress={() => model.stopContainer(item)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Stop" systemImage="stop.fill" />
					</Button>
					<Button
						label="Restart"
						systemImage="arrow.clockwise"
						onPress={() => model.restartContainer(item)}
					/>
					{model.canKill(item) ? (
						<Button
							role="destructive"
							onPress={() => model.requestKill(item)}
							modifiers={[tint(systemColors.red)]}
						>
							<DestructiveLabel text="Kill" systemImage="bolt.fill" />
						</Button>
					) : null}
				</>
			) : (
				<>
					<Button
						label="Start"
						systemImage="play.fill"
						onPress={() => model.startContainer(item)}
					/>
					<Button
						role="destructive"
						onPress={() => model.requestRemove(item)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Remove" />
					</Button>
				</>
			)}
		</>
	);
}

function ContainerPreview({ item }: { item: ContainerItem }) {
	const isDark = useIsDark();
	const running = containerIsRunning(item.value);
	const firstName = trimSlashes(item.value.names[0] ?? '');
	return (
		<RowPreviewCard
			icon="cube.box.fill"
			iconColor={running ? systemColors.green : systemColors.gray}
			iconUrl={themedIconUrl(item.value, isDark)}
			title={containerDisplayName(item.value)}
			badges={[
				{
					text: running ? 'Running' : 'Stopped',
					color: running ? systemColors.green : systemColors.gray
				}
			]}
			details={[
				{ icon: 'photo', label: 'Image', value: item.value.image },
				{ icon: 'info.circle', label: 'Status', value: item.value.status },
				...(firstName !== '' ? [{ icon: 'tag', label: 'Name', value: firstName }] : []),
				...(item.environmentName
					? [{ icon: 'server.rack', label: 'Environment', value: item.environmentName }]
					: [])
			]}
		/>
	);
}

function ContainerLink({ model, item }: { model: ContainersListModel; item: ContainerItem }) {
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
	if (model.isSelecting) return row;

	const pinLabel = isPinned ? 'Unpin' : 'Pin';
	const pinImage: SFSymbol = isPinned ? 'pin.slash.fill' : 'pin.fill';
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Trigger>
					<Button onPress={() => model.openDetail(item)} modifiers={[buttonStyle('plain')]}>
						<HStack modifiers={[contentShape(shapes.rectangle())]}>
							{row}
							<DisclosureChevron />
						</HStack>
					</Button>
				</ContextMenu.Trigger>
				<ContextMenu.Items>
					<Button label={pinLabel} systemImage={pinImage} onPress={() => model.togglePin(item)} />
					<ContainerMenuActions model={model} item={item} />
				</ContextMenu.Items>
				<ContextMenu.Preview>
					<ContainerPreview item={item} />
				</ContextMenu.Preview>
			</ContextMenu>
			<SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
				<Button
					label={pinLabel}
					systemImage={pinImage}
					onPress={() => model.togglePinAfterSwipe(item)}
					modifiers={[tint(systemColors.yellow)]}
				/>
				<Button
					label="Logs"
					systemImage="text.alignleft"
					onPress={() => model.openLogs(item)}
					modifiers={[tint(systemColors.blue)]}
				/>
			</SwipeActions.Actions>
			<SwipeActions.Actions edge="trailing">
				{containerIsRunning(item.value) ? (
					<>
						<Button
							role="destructive"
							label="Stop"
							systemImage="stop.fill"
							onPress={() => model.stopContainer(item)}
						/>
						<Button
							label="Restart"
							systemImage="arrow.clockwise"
							onPress={() => model.restartContainer(item)}
							modifiers={[tint(systemColors.orange)]}
						/>
					</>
				) : (
					<Button
						label="Start"
						systemImage="play.fill"
						onPress={() => model.startContainer(item)}
						modifiers={[tint(systemColors.green)]}
					/>
				)}
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function ContainersScreen(props: ContainersListProps) {
	const model = useContainersList(props);
	const { snapshot, containers } = model;

	let content;
	if (snapshot.isLoading && containers.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && containers.length === 0) {
		content = (
			<ContentUnavailableView
				title="Error"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
			/>
		);
	} else if (containers.length === 0) {
		content = (
			<UnavailableView
				title="No Containers"
				systemImage="cube.box"
				description={
					props.allEnvironments
						? 'No containers found in any environment.'
						: 'No containers found in this environment.'
				}
				actions={[{ title: 'Refresh', onPress: () => void model.loadContainers() }]}
			/>
		);
	} else {
		content = (
			<List
				selection={model.isSelecting ? model.selection : undefined}
				onSelectionChange={(selection) => {
					if (!model.isSelecting) return;
					const next = selection.map(String);
					for (const id of new Set([...next, ...model.selection])) {
						if (next.includes(id) !== model.selection.includes(id)) model.toggleSelected(id);
					}
				}}
				modifiers={[
					listStyle('insetGrouped'),
					environment('editMode', model.isSelecting ? 'active' : 'inactive'),
					refreshable(model.refresh)
				]}
			>
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.loadContainers()}
				/>
				<StableSectionedList
					sections={model.sections}
					preferredHeaderAccessorySectionID="running"
					headerAccessory={() => (
						<ResourceCountLabel
							loadedCount={containers.length}
							totalCount={snapshot.totalItems}
							hasMore={snapshot.hasMore}
						/>
					)}
					estimatedItemSize={72}
					renderRow={(item) => <ContainerLink model={model} item={item} />}
				/>
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
					title: 'Containers',
					headerSearchBarOptions: {
						placeholder: 'Search containers',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<ContainersToolbar model={model} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
