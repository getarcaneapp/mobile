import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContextMenu,
	HStack,
	Label,
	LabeledContent,
	List,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	layoutPriority,
	lineLimit,
	listStyle,
	refreshable,
	scrollEdgeEffectStyle,
	shapes,
	textSelection,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import type { Pod } from '@/sdk/models/podman/Pod';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { AppToolbar } from '@/ui/app-toolbar';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { CopyValueRow, SwarmKeyValueRows, SwarmListState } from '@/features/swarm/swarm-parts';

import { shortID } from './podman-common';
import { podmanStateVariant } from './podman-logic';
import type { PodmanMenuAction } from './podman-parts.types';
import { PodmanStateBadge } from './podman-state-badge';
import { usePodmanPodDetail, usePodmanPods, type PodmanPodsModel } from './use-podman-pods';

export function PodmanMenuItems({ actions }: { actions: PodmanMenuAction[] }) {
	return (
		<>
			{actions.map((action) =>
				action.destructive ? (
					<Button
						key={action.id}
						role="destructive"
						onPress={action.onPress}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text={action.title} />
					</Button>
				) : (
					<Button key={action.id} onPress={action.onPress}>
						<Label title={action.title} systemImage={action.systemImage as never} />
					</Button>
				)
			)}
		</>
	);
}

function PodRow({ model, pod }: { model: PodmanPodsModel; pod: Pod }) {
	const stopped = podmanStateVariant(pod.status) === 'stopped';
	const link = (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button
					onPress={() => model.openDetail(pod)}
					modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
				>
					<HStack spacing={12}>
						<RowIcon
							systemImage="circle.hexagongrid.fill"
							tint={stopped ? systemColors.gray : undefined}
							identity={pod.id}
						/>
						<VStack alignment="leading" spacing={3} modifiers={[layoutPriority(1)]}>
							<Text modifiers={[font({ textStyle: 'body' }), lineLimit(1)]}>
								{pod.name || shortID(pod.id)}
							</Text>
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{model.containersText(pod)}
							</Text>
						</VStack>
						<Spacer minLength={8} />
						<PodmanStateBadge key={pod.id} state={pod.status} />
						<DisclosureChevron />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				<PodmanMenuItems actions={model.menuActions(pod)} />
			</ContextMenu.Items>
		</ContextMenu>
	);
	if (!model.canDelete) return link;
	return (
		<SwipeActions>
			{link}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Remove"
					systemImage="trash"
					onPress={() => model.requestDelete(pod)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function PodmanPodsScreen() {
	const model = usePodmanPods();
	const { snapshot, items } = model;
	const accent = useAccentColor();
	const icon = useToolbarIcons(['scissors']);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Pods',
					headerSearchBarOptions: {
						placeholder: 'Search pods',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			{model.canPrune ? (
				<AppToolbar placement="right" tintColor={accent}>
					<AppToolbar.Button
						icon={icon('scissors')}
						accessibilityLabel="Prune Pods"
						onPress={model.requestPrune}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<SwarmListState
					isLoading={snapshot.isLoading}
					isEmpty={items.length === 0}
					errorMessage={snapshot.errorMessage}
					emptyTitle={model.emptyTitle}
					emptySystemImage="circle.hexagongrid"
					retry={() => void model.load()}
				>
					<List
						modifiers={[
							listStyle('insetGrouped'),
							scrollEdgeEffectStyle('soft', 'top'),
							refreshable(model.load)
						]}
					>
						<Section
							header={
								<ResourceCountSectionHeader
									title="Pods"
									loadedCount={items.length}
									totalCount={snapshot.totalItems}
									hasMore={snapshot.hasMore}
								/>
							}
						>
							<List.ForEach data={items} keyExtractor={stableItemKey} estimatedItemSize={56}>
								{({ item }) => <PodRow model={model} pod={item.value} />}
							</List.ForEach>
							<PaginatedListFooter
								hasMore={snapshot.hasMore}
								loadMoreError={snapshot.loadMoreError}
								onRetry={() => void model.loadMore()}
								onLoadMore={() => void model.loadMore()}
							/>
						</Section>
					</List>
				</SwarmListState>
			</Host>
		</>
	);
}

function SecondaryValue({ value, monospaced }: { value: string; monospaced?: boolean }) {
	return (
		<Text
			modifiers={[
				font(monospaced ? { textStyle: 'callout', design: 'monospaced' } : { textStyle: 'body' }),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				textSelection(true)
			]}
		>
			{value}
		</Text>
	);
}

export function PodmanPodDetailScreen() {
	const model = usePodmanPodDetail();
	const { inspect } = model;
	let content;
	if (inspect) {
		content = (
			<List
				modifiers={[
					listStyle('insetGrouped'),
					scrollEdgeEffectStyle('soft', 'top'),
					refreshable(model.load)
				]}
			>
				<Section title="Overview">
					<LabeledContent label="State">
						<PodmanStateBadge state={model.state} />
					</LabeledContent>
					<CopyValueRow title="ID" value={inspect.id} />
					{inspect.infraContainerId ? (
						<CopyValueRow title="Infra Container" value={inspect.infraContainerId} />
					) : null}
					{model.overview.map((row) => (
						<LabeledContent key={row.title} label={row.title}>
							<SecondaryValue value={row.value} />
						</LabeledContent>
					))}
				</Section>
				<Section title={`Containers (${model.containers.length})`}>
					{model.containers.map((container) => (
						<HStack key={container.id} spacing={12}>
							<RowIcon
								systemImage={container.isInfra ? 'gearshape.fill' : 'cube.box.fill'}
								tint={container.isInfra ? systemColors.gray : undefined}
							/>
							<VStack alignment="leading" spacing={3} modifiers={[layoutPriority(1)]}>
								<Text modifiers={[lineLimit(1)]}>{container.name || shortID(container.id)}</Text>
								{container.image ? (
									<Text
										modifiers={[
											font({ textStyle: 'caption' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
											lineLimit(1)
										]}
									>
										{container.image}
									</Text>
								) : null}
							</VStack>
							<Spacer minLength={8} />
							<PodmanStateBadge state={container.state} />
						</HStack>
					))}
				</Section>
				{model.processes.length > 0 ? (
					<Section
						title="Processes"
						footer={
							<Text modifiers={[font({ textStyle: 'caption', design: 'monospaced' })]}>
								{model.processHeader}
							</Text>
						}
					>
						<List.ForEach
							data={model.processes}
							keyExtractor={stableItemKey}
							estimatedItemSize={44}
						>
							{({ item }) => (
								<Text
									modifiers={[font({ textStyle: 'caption', design: 'monospaced' }), lineLimit(2)]}
								>
									{item.text}
								</Text>
							)}
						</List.ForEach>
					</Section>
				) : null}
				{model.labels.length > 0 ? (
					<Section title="Labels">
						<SwarmKeyValueRows pairs={model.labels} />
					</Section>
				) : null}
			</List>
		);
	} else if (model.errorMessage !== undefined) {
		content = (
			<UnavailableView
				title="Couldn't Load Pod"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.load() }]}
			/>
		);
	} else {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	}
	return (
		<>
			<Stack.Screen options={{ title: model.displayName, headerLargeTitleEnabled: false }} />
			<ResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				runningItemID={model.toolbar.runningItemID}
				isDisabled={model.toolbar.isDisabled}
				resourceName={model.displayName}
			/>
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
