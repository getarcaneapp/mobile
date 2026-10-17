import { Host } from '@/ui/host';
import { HStack, Label, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
	font,
	foregroundStyle,
	lineLimit,
	listStyle,
	padding,
	refreshable,
	scrollEdgeEffectStyle,
	textSelection,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { SwarmTaskSummary } from '@/sdk/models/swarm/SwarmTask';
import { systemColors } from '@/theme/colors';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';

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
		<VStack alignment="leading" spacing={6} modifiers={[padding({ vertical: 2 })]}>
			<HStack alignment="firstTextBaseline">
				<Text
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'semibold' }),
						lineLimit(1),
						truncationMode('middle')
					]}
				>
					{taskTitle(task, showsService)}
				</Text>
				<Spacer minLength={8} />
				<SwarmStateBadge state={task.currentState} />
			</HStack>
			<HStack
				spacing={12}
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
					lineLimit(1)
				]}
			>
				<Label title={taskNodeName(task)} systemImage="server.rack" />
				{task.desiredState !== task.currentState ? (
					<Label title={`Wants ${task.desiredState}`} systemImage="arrow.right.circle" />
				) : null}
			</HStack>
			{task.error ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle(systemColors.red),
						lineLimit(3),
						textSelection(true)
					]}
				>
					{task.error}
				</Text>
			) : null}
			<Text
				modifiers={[
					font({ textStyle: 'caption2' }),
					foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
				]}
			>
				{swarmDate(task.updatedAt)}
			</Text>
		</VStack>
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
	return (
		<SwarmListState
			isLoading={snapshot.isLoading}
			isEmpty={items.length === 0}
			errorMessage={snapshot.errorMessage}
			emptyTitle="No Tasks"
			emptySystemImage="checklist"
			retry={() => void load()}
		>
			<List
				modifiers={[
					listStyle('insetGrouped'),
					scrollEdgeEffectStyle('soft', 'top'),
					refreshable(load)
				]}
			>
				<Section
					header={
						<ResourceCountSectionHeader
							title="Tasks"
							loadedCount={items.length}
							totalCount={snapshot.totalItems}
							hasMore={snapshot.hasMore}
						/>
					}
				>
					{items.map((item) => (
						<SwarmTaskRow
							key={item.id}
							task={item.value}
							showsService={showsServiceFor(source, item.value)}
						/>
					))}
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={() => void loadMore()}
						onLoadMore={() => void loadMore()}
					/>
				</Section>
			</List>
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
	const taskSource = taskSourceFromParams(source, value);
	return (
		<>
			<Stack.Screen options={{ title: title ?? 'Tasks' }} />
			<Host style={{ flex: 1 }}>
				<SwarmTasksList environmentID={envID} source={taskSource} />
			</Host>
		</>
	);
}
