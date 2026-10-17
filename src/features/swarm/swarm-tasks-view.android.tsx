/** Android rendering of `SwarmTasksView` + `SwarmTaskRow`. */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { SwarmTaskSummary } from '@/sdk/models/swarm/SwarmTask';
import { colors, systemColors } from '@/theme/colors';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { SectionTitle } from '@/features/networks/android-parts';

import { swarmDate } from './swarm-common';
import { SwarmListState, SwarmStateBadge } from './swarm-parts';
import type { SwarmTaskSource } from './swarm-routes';
import {
	showsServiceFor,
	taskNodeName,
	taskSourceFromParams,
	taskTitle,
	useSwarmTasks
} from './use-swarm-tasks';

export function SwarmTaskRow({
	task,
	showsService = true
}: {
	task: SwarmTaskSummary;
	showsService?: boolean;
}) {
	return (
		<View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<Text
					numberOfLines={1}
					ellipsizeMode="middle"
					style={[m3Type.titleSmall, { color: colors.label, flex: 1 }]}
				>
					{taskTitle(task, showsService)}
				</Text>
				<SwarmStateBadge state={task.currentState} />
			</View>
			<View style={{ flexDirection: 'row', gap: 12 }}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
					<Icon name="server.rack" size={12} color={colors.secondaryLabel} />
					<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{taskNodeName(task)}
					</Text>
				</View>
				{task.desiredState !== task.currentState ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
						<Icon name="arrow.right.circle" size={12} color={colors.secondaryLabel} />
						<Text
							numberOfLines={1}
							style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
						>{`Wants ${task.desiredState}`}</Text>
					</View>
				) : null}
			</View>
			{task.error ? (
				<Text numberOfLines={3} style={[m3Type.bodySmall, { color: systemColors.red }]}>
					{task.error}
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
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void load().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
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
				<MaterialListGroup>
					{items.map((item) => (
						<SwarmTaskRow
							key={item.id}
							task={item.value}
							showsService={showsServiceFor(source, item.value)}
						/>
					))}
				</MaterialListGroup>
				<PaginatedListFooter
					hasMore={snapshot.hasMore}
					loadMoreError={snapshot.loadMoreError}
					onRetry={() => void loadMore()}
					onLoadMore={() => void loadMore()}
				/>
			</ScrollView>
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
