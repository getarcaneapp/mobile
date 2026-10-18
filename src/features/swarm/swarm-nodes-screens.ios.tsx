import { Host } from '@/ui/host';
import {
	Alert,
	Button,
	ContextMenu,
	HStack,
	Label,
	LabeledContent,
	List,
	Menu,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	autocorrectionDisabled,
	buttonStyle,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	refreshable,
	scrollEdgeEffectStyle,
	textInputAutocapitalization,
	textSelection,
	tint,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import type { SwarmNode } from '@/sdk/models/swarm/SwarmNode';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { MonospacedValue } from '@/ui/components/resource-detail';
import { RowIcon } from '@/ui/components/row-icon';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

import { LinkRow } from '@/features/containers/container-sections';
import { BoundTextField } from '@/features/containers/swiftui-text-field';

import { capitalized, nodeIsLeader, nodeIsManager, swarmDate } from './swarm-common';
import { SwarmListState, SwarmStateBadge } from './swarm-parts';
import {
	availabilityValues,
	nodeRoleTitle,
	nodeSubtitle,
	useSwarmNodeDetail,
	useSwarmNodes,
	type SwarmNodesModel
} from './use-swarm-nodes';

export function SwarmNodeRow({ node }: { node: SwarmNode }) {
	return (
		<HStack spacing={12} modifiers={[accessibilityElement('combine')]}>
			<RowIcon
				systemImage={nodeIsManager(node) ? 'crown.fill' : 'server.rack'}
				tint={nodeIsLeader(node) ? systemColors.yellow : undefined}
			/>
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[lineLimit(1)]}>{node.hostname}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					{nodeSubtitle(node)}
				</Text>
			</VStack>
			<Spacer minLength={8} />
			<VStack alignment="trailing" spacing={4}>
				<SwarmStateBadge key={`${node.id}/status`} state={node.status} />
				{node.availability.toLowerCase() !== 'active' ? (
					<SwarmStateBadge key={`${node.id}/availability`} state={node.availability} />
				) : null}
			</VStack>
		</HStack>
	);
}

function AvailabilityMenu({
	current,
	onSelect
}: {
	current: string;
	onSelect: (value: string) => void;
}) {
	return (
		<Menu
			label={
				<Label
					title="Availability"
					systemImage="slider.horizontal.below.square.and.square.filled"
				/>
			}
		>
			{availabilityValues.map((value) =>
				current.toLowerCase() === value ? (
					<Button
						key={value}
						label={capitalized(value)}
						systemImage="checkmark"
						onPress={() => onSelect(value)}
						modifiers={[disabled(true)]}
					/>
				) : (
					<Button key={value} label={capitalized(value)} onPress={() => onSelect(value)} />
				)
			)}
		</Menu>
	);
}

function NodeLink({ model, node }: { model: SwarmNodesModel; node: SwarmNode }) {
	return (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button
					onPress={() => model.openDetail(node)}
					modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
				>
					<HStack>
						<SwarmNodeRow node={node} />
						<DisclosureChevron />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				{model.canManage ? (
					<>
						{nodeIsManager(node) ? (
							<Button onPress={() => model.run({ kind: 'demote' }, node)}>
								<Label title="Demote to Worker" systemImage="arrow.down.circle" />
							</Button>
						) : (
							<Button onPress={() => model.run({ kind: 'promote' }, node)}>
								<Label title="Promote to Manager" systemImage="arrow.up.circle" />
							</Button>
						)}
						<AvailabilityMenu
							current={node.availability}
							onSelect={(value) => model.run({ kind: 'availability', value }, node)}
						/>
						<Button
							role="destructive"
							onPress={() => model.requestRemove(node)}
							modifiers={[tint(systemColors.red)]}
						>
							<DestructiveLabel text="Remove" />
						</Button>
					</>
				) : null}
			</ContextMenu.Items>
		</ContextMenu>
	);
}

export function SwarmNodesScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useSwarmNodes(envID);
	const { snapshot, items } = model;
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Nodes',
					headerSearchBarOptions: {
						placeholder: 'Search nodes',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<Host style={{ flex: 1 }}>
				<SwarmListState
					isLoading={snapshot.isLoading}
					isEmpty={items.length === 0}
					errorMessage={snapshot.errorMessage}
					emptyTitle={model.emptyTitle}
					emptySystemImage="server.rack"
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
									title="Nodes"
									loadedCount={items.length}
									totalCount={snapshot.totalItems}
									hasMore={snapshot.hasMore}
								/>
							}
						>
							<List.ForEach data={items} keyExtractor={stableItemKey} estimatedItemSize={52}>
								{({ item }) => <NodeLink model={model} node={item.value} />}
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

function Value({ label, value }: { label: string; value: string }) {
	return (
		<LabeledContent label={label}>
			<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
				{value}
			</Text>
		</LabeledContent>
	);
}

export function SwarmNodeDetailScreen() {
	const model = useSwarmNodeDetail();
	const accent = useAccentColor();
	const { node } = model;
	if (!node) return <Stack.Screen options={{ title: '' }} />;
	const plainField = [textInputAutocapitalization('never'), autocorrectionDisabled()];
	return (
		<>
			<Stack.Screen options={{ title: node.hostname, headerLargeTitleEnabled: false }} />
			<ResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				runningItemID={model.toolbar.runningItemID}
				isDisabled={model.toolbar.isDisabled}
				resourceName={node.hostname}
				active={model.canManage}
			/>
			<Host style={{ flex: 1 }}>
				<List
					modifiers={[
						listStyle('insetGrouped'),
						scrollEdgeEffectStyle('soft', 'top'),
						refreshable(model.reload)
					]}
				>
					<Section>
						<HStack spacing={14}>
							<Image
								systemName={nodeIsManager(node) ? 'crown.fill' : 'server.rack'}
								modifiers={[
									font({ textStyle: 'title' }),
									foregroundStyle(nodeIsLeader(node) ? systemColors.yellow : accent),
									frame({ width: 52, height: 52 }),
									accessibilityHidden(true)
								]}
							/>
							<VStack alignment="leading" spacing={4}>
								<Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>
									{node.hostname}
								</Text>
								<Text
									modifiers={[
										font({ textStyle: 'caption' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>
									{nodeRoleTitle(node)}
								</Text>
								<HStack spacing={6}>
									<SwarmStateBadge state={node.status} />
									<SwarmStateBadge state={node.availability} />
								</HStack>
							</VStack>
						</HStack>
					</Section>
					<Section title="Details">
						<LabeledContent label="ID">
							<MonospacedValue value={node.id.slice(0, 12)} />
						</LabeledContent>
						{node.address ? (
							<LabeledContent label="Address">
								<MonospacedValue value={node.address} />
							</LabeledContent>
						) : null}
						{node.reachability ? (
							<LabeledContent label="Reachability">
								<SwarmStateBadge state={node.reachability} />
							</LabeledContent>
						) : null}
						{node.managerAddress ? (
							<LabeledContent label="Manager Address">
								<MonospacedValue value={node.managerAddress} />
							</LabeledContent>
						) : null}
						{node.engineVersion ? <Value label="Engine" value={node.engineVersion} /> : null}
						{node.platform ? <Value label="Platform" value={node.platform} /> : null}
						<Value label="Created" value={swarmDate(node.createdAt)} />
						<Value label="Updated" value={swarmDate(node.updatedAt)} />
						<LinkRow title="Tasks" systemImage="checklist" onPress={model.openTasks} />
					</Section>
					<Section
						header={<Text>Labels</Text>}
						footer={
							model.canManage && model.labels.length > 0 ? (
								<Text>Swipe a label to remove it.</Text>
							) : undefined
						}
					>
						{model.labels.map(([key, value]) =>
							model.canManage ? (
								<SwipeActions key={key}>
									<LabeledContent label={key}>
										<Text
											modifiers={[
												font({ textStyle: 'callout', design: 'monospaced' }),
												textSelection(true)
											]}
										>
											{value}
										</Text>
									</LabeledContent>
									<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
										<Button
											label="Remove"
											systemImage="trash"
											onPress={() => model.removeLabel(key)}
											modifiers={[tint(systemColors.red)]}
										/>
									</SwipeActions.Actions>
								</SwipeActions>
							) : (
								<LabeledContent key={key} label={key}>
									<Text
										modifiers={[
											font({ textStyle: 'callout', design: 'monospaced' }),
											textSelection(true)
										]}
									>
										{value}
									</Text>
								</LabeledContent>
							)
						)}
						{model.canManage ? (
							<Alert
								title="Add Label"
								isPresented={model.showAddLabel}
								onIsPresentedChange={model.setShowAddLabel}
							>
								<Alert.Trigger>
									<Button onPress={model.beginAddLabel}>
										<Label title="Add Label" systemImage="plus" />
									</Button>
								</Alert.Trigger>
								<Alert.Actions>
									<BoundTextField
										placeholder="Key"
										value={model.newLabelKey}
										onChangeText={model.setNewLabelKey}
										modifiers={plainField}
									/>
									<BoundTextField
										placeholder="Value"
										value={model.newLabelValue}
										onChangeText={model.setNewLabelValue}
										modifiers={plainField}
									/>
									<Button label="Add" onPress={model.commitAddLabel} />
									<Button
										label="Cancel"
										role="cancel"
										onPress={() => model.setShowAddLabel(false)}
									/>
								</Alert.Actions>
							</Alert>
						) : null}
					</Section>
					<Section
						header={<Text>Arcane Agent</Text>}
						footer={<Text>Pair node agents from Arcane on the web.</Text>}
					>
						<LabeledContent label="State">
							<SwarmStateBadge state={node.agent.state} />
						</LabeledContent>
						{node.agent.environmentName ? (
							<Value label="Environment" value={node.agent.environmentName} />
						) : null}
						{node.agent.bindingKind ? (
							<Value label="Binding" value={capitalized(node.agent.bindingKind)} />
						) : null}
						{model.agentHeartbeat ? (
							<Value label="Last Heartbeat" value={model.agentHeartbeat} />
						) : null}
					</Section>
				</List>
			</Host>
		</>
	);
}
