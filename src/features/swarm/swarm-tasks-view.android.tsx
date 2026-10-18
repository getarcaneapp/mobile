import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { SwarmTaskSummary } from '@/sdk/models/swarm/SwarmTask';
import { colors, systemColors } from '@/theme/colors';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { SectionTitle } from '@/features/networks/android-parts';

import { swarmDate } from './swarm-common';
import { SwarmListState, SwarmStateBadge } from './swarm-parts';
import type { SwarmTaskSource } from './swarm-routes';
import {
	showsServiceFor,
	taskErrorMessage,
	taskNodeName,
	taskSourceFromParams,
	taskTitle,
	useSwarmTasks
} from './use-swarm-tasks';

const taskRowStyle = { paddingHorizontal: 16, paddingVertical: 10, gap: 6 };
const titleLineStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 };
const metaStyle = { flexDirection: 'row' as const, gap: 12 };
const metaItemStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 };
const listContentStyle = { paddingBottom: 32 };

export function SwarmTaskRow({
	task,
	showsService = true
}: {
	task: SwarmTaskSummary;
	showsService?: boolean;
}) {
	return (
		<View style={taskRowStyle}>
			<View style={titleLineStyle}>
				<Text
					numberOfLines={1}
					ellipsizeMode="middle"
					style={[m3Type.titleSmall, { color: colors.label, flex: 1 }]}
				>
					{taskTitle(task, showsService)}
				</Text>
				<SwarmStateBadge state={task.currentState} />
			</View>
			<View style={metaStyle}>
				<View style={metaItemStyle}>
					<Icon name="server.rack" size={12} color={colors.secondaryLabel} />
					<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{taskNodeName(task)}
					</Text>
				</View>
				{task.desiredState !== task.currentState ? (
					<View style={metaItemStyle}>
						<Icon name="arrow.right.circle" size={12} color={colors.secondaryLabel} />
						<Text
							numberOfLines={1}
							style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
						>{`Wants ${task.desiredState}`}</Text>
					</View>
				) : null}
			</View>
			{taskErrorMessage(task) ? (
				<Text numberOfLines={3} style={[m3Type.bodySmall, { color: systemColors.red }]}>
					{taskErrorMessage(task)}
				</Text>
			) : null}
			<Text style={[m3Type.labelSmall, { color: colors.tertiaryLabel }]}>
				{swarmDate(task.updatedAt)}
			</Text>
		</View>
	);
}

export function SwarmTasksList({
	environmentID,
	source
}: {
	environmentID: EnvironmentID;
	source: SwarmTaskSource;
}) {
	const { snapshot, items, load, loadMore } = useSwarmTasks(environmentID, source);
	const [refreshing, setRefreshing] = useState(false);
	return (
		<SwarmListState
			isLoading={snapshot.isLoading}
			isEmpty={items.length === 0}
			errorMessage={snapshot.errorMessage}
			emptyTitle="No Tasks"
			emptySystemImage="checklist"
			retry={() => void load()}
		>
			<GroupedFlashList
				data={items.map((item, index) => ({
					key: String(item.id),
					type: 'item',
					task: item.value,
					grouped: groupPosition(index, items.length)
				}))}
				renderEntry={(entry) => (
					<SwarmTaskRow task={entry.task} showsService={showsServiceFor(source, entry.task)} />
				)}
				header={
					<SectionTitle
						title="Tasks"
						trailing={
							<ResourceCountLabel
								loadedCount={items.length}
								totalCount={snapshot.totalItems}
								hasMore={snapshot.hasMore}
							/>
						}
					/>
				}
				footer={
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={() => void loadMore()}
						onLoadMore={() => void loadMore()}
					/>
				}
				onEndReached={
					snapshot.hasMore && snapshot.loadMoreError === undefined
						? () => void loadMore()
						: undefined
				}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void load().finally(() => setRefreshing(false));
						}}
					/>
				}
				contentContainerStyle={listContentStyle}
			/>
		</SwarmListState>
	);
}

export function SwarmTasksScreen() {
	const {
		envID = '0',
		source,
		value,
		title
	} = useLocalSearchParams<{ envID?: string; source?: string; value?: string; title?: string }>();
	return (
		<>
			<Stack.Screen options={{ title: title ?? 'Tasks' }} />
			<SwarmTasksList environmentID={envID} source={taskSourceFromParams(source, value)} />
		</>
	);
}
