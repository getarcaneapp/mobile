/** Android renderings of `SwarmNodesView` and `SwarmNodeDetailView`. */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import type { SwarmNode } from '@/sdk/models/swarm/SwarmNode';
import { colors, systemColors } from '@/theme/colors';
import { ResourceCountLabel } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { M3Section, ValueRow } from '@/features/containers/android-material';
import { AndroidResourceActionsToolbar } from '@/features/containers/android-toolbar';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';
import {
	ActionItem,
	LabeledRow,
	LinkItem,
	MonoText,
	SectionTitle
} from '@/features/networks/android-parts';

import { capitalized, nodeIsLeader, nodeIsManager, swarmDate } from './swarm-common';
import { PromptDialog } from './swarm-dialogs';
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
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
			<RowIcon
				systemImage={nodeIsManager(node) ? 'crown.fill' : 'server.rack'}
				tint={nodeIsLeader(node) ? systemColors.yellow : undefined}
			/>
			<View style={{ flex: 1, gap: 3 }}>
				<Text numberOfLines={1} style={[m3Type.bodyLarge, { color: colors.label }]}>
					{node.hostname}
				</Text>
				<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{nodeSubtitle(node)}
				</Text>
			</View>
			<View style={{ alignItems: 'flex-end', gap: 4 }}>
				<SwarmStateBadge state={node.status} />
				{node.availability.toLowerCase() !== 'active' ? (
					<SwarmStateBadge state={node.availability} />
				) : null}
			</View>
		</View>
	);
}

function NodeListRow({ model, node }: { model: SwarmNodesModel; node: SwarmNode }) {
	const items: RowMenuItem[] = [];
	if (model.canManage) {
		items.push(
			nodeIsManager(node)
				? {
						id: 'demote',
						title: 'Demote to Worker',
						onPress: () => model.run({ kind: 'demote' }, node)
					}
				: {
						id: 'promote',
						title: 'Promote to Manager',
						onPress: () => model.run({ kind: 'promote' }, node)
					}
		);
		for (const value of availabilityValues) {
			items.push({
				id: `availability-${value}`,
				title: `Availability: ${capitalized(value)}`,
				disabled: node.availability.toLowerCase() === value,
				onPress: () => model.run({ kind: 'availability', value }, node)
			});
		}
		items.push({
			id: 'remove',
			title: 'Remove',
			destructive: true,
			onPress: () => model.requestRemove(node)
		});
	}
	return (
		<LongPressMenu
			title={node.hostname}
			items={items}
			onPress={() => model.openDetail(node)}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<SwarmNodeRow node={node} />
		</LongPressMenu>
	);
}

export function SwarmNodesScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useSwarmNodes(envID);
	const { snapshot, items } = model;
	const [refreshing, setRefreshing] = useState(false);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Nodes',
					headerSearchBarOptions: {
						placeholder: 'Search nodes',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<SwarmListState
				isLoading={snapshot.isLoading}
				isEmpty={items.length === 0}
				errorMessage={snapshot.errorMessage}
				emptyTitle={model.emptyTitle}
				emptySystemImage="server.rack"
				retry={() => void model.load()}
			>
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ paddingBottom: 32 }}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => {
								setRefreshing(true);
								void model.load().finally(() => setRefreshing(false));
							}}
						/>
					}
				>
					<SectionTitle
						title="Nodes"
						trailing={
							<ResourceCountLabel
								loadedCount={items.length}
								totalCount={snapshot.totalItems}
								hasMore={snapshot.hasMore}
							/>
						}
					/>
					<MaterialListGroup>
						{items.map((item) => (
							<NodeListRow key={item.id} model={model} node={item.value} />
						))}
					</MaterialListGroup>
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				</ScrollView>
			</SwarmListState>
		</>
	);
}

export function SwarmNodeDetailScreen() {
	const model = useSwarmNodeDetail();
	const [refreshing, setRefreshing] = useState(false);
	const { node } = model;
	if (!node) return <Stack.Screen options={{ title: '' }} />;
	return (
		<>
			<Stack.Screen options={{ title: node.hostname }} />
			{model.canManage ? (
				<AndroidResourceActionsToolbar
					primary={model.toolbar.primary}
					secondary={model.toolbar.secondary}
					overflow={model.toolbar.overflow}
					runningItemID={model.toolbar.runningItemID}
					isDisabled={model.toolbar.isDisabled}
					resourceName={node.hostname}
				/>
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.reload().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
						<Icon
							name={nodeIsManager(node) ? 'crown.fill' : 'server.rack'}
							size={32}
							color={nodeIsLeader(node) ? systemColors.yellow : m3.primary}
						/>
						<View style={{ flex: 1, gap: 4 }}>
							<Text style={[m3Type.titleLarge, { color: colors.label }]}>{node.hostname}</Text>
							<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
								{nodeRoleTitle(node)}
							</Text>
							<View style={{ flexDirection: 'row', gap: 6 }}>
								<SwarmStateBadge state={node.status} />
								<SwarmStateBadge state={node.availability} />
							</View>
						</View>
					</View>
				</M3Section>
				<M3Section title="Details">
					<ValueRow title="ID" value={node.id.slice(0, 12)} monospaced />
					{node.address ? <ValueRow title="Address" value={node.address} monospaced /> : null}
					{node.reachability ? (
						<LabeledRow title="Reachability">
							<SwarmStateBadge state={node.reachability} />
						</LabeledRow>
					) : null}
					{node.managerAddress ? (
						<ValueRow title="Manager Address" value={node.managerAddress} monospaced />
					) : null}
					{node.engineVersion ? <ValueRow title="Engine" value={node.engineVersion} /> : null}
					{node.platform ? <ValueRow title="Platform" value={node.platform} /> : null}
					<ValueRow title="Created" value={swarmDate(node.createdAt)} />
					<ValueRow title="Updated" value={swarmDate(node.updatedAt)} />
					<LinkItem title="Tasks" icon="checklist" onPress={model.openTasks} />
				</M3Section>
				<M3Section
					title="Labels"
					footer={
						model.canManage && model.labels.length > 0
							? 'Long-press a label to remove it.'
							: undefined
					}
				>
					{model.labels.map(([key, value]) => (
						<LongPressMenu
							key={key}
							title={key}
							items={
								model.canManage
									? [
											{
												id: 'remove',
												title: 'Remove',
												destructive: true,
												onPress: () => model.removeLabel(key)
											}
										]
									: []
							}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 16,
								minHeight: 48,
								paddingHorizontal: 16,
								paddingVertical: 10
							}}
						>
							<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{key}</Text>
							<View style={{ flex: 1, alignItems: 'flex-end' }}>
								<MonoText value={value} />
							</View>
						</LongPressMenu>
					))}
					{model.canManage ? (
						<ActionItem title="Add Label" icon="plus" onPress={model.beginAddLabel} />
					) : null}
				</M3Section>
				<M3Section title="Arcane Agent" footer="Pair node agents from Arcane on the web.">
					<LabeledRow title="State">
						<SwarmStateBadge state={node.agent.state} />
					</LabeledRow>
					{node.agent.environmentName ? (
						<ValueRow title="Environment" value={node.agent.environmentName} />
					) : null}
					{node.agent.bindingKind ? (
						<ValueRow title="Binding" value={capitalized(node.agent.bindingKind)} />
					) : null}
					{model.agentHeartbeat ? (
						<ValueRow title="Last Heartbeat" value={model.agentHeartbeat} />
					) : null}
				</M3Section>
			</ScrollView>
			<PromptDialog
				visible={model.showAddLabel}
				title="Add Label"
				fields={[
					{ placeholder: 'Key', value: model.newLabelKey, onChangeText: model.setNewLabelKey },
					{ placeholder: 'Value', value: model.newLabelValue, onChangeText: model.setNewLabelValue }
				]}
				confirmTitle="Add"
				onConfirm={model.commitAddLabel}
				onCancel={() => model.setShowAddLabel(false)}
			/>
		</>
	);
}
