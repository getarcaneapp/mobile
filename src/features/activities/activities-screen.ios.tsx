import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContentUnavailableView,
	DisclosureGroup,
	HStack,
	List,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	accessibilityElement,
	accessibilityHint,
	accessibilityLabel,
	buttonStyle,
	font,
	lineLimit,
	foregroundStyle,
	frame,
	listStyle,
	padding,
	refreshable,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import type { ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { Activity } from '@/sdk/models/activity/Activity';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { ErrorBanner } from '@/ui/components/error-banner';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { DisclosureChevron } from '@/ui/settings-row';

import {
	ActivityBatch,
	ActivityCenterItem,
	ActivityDisplay,
	ActivityStatusFilter,
	activityDisplayName,
	activityItemKey,
	activityStatusTint,
	dateMs,
	relativeNamed,
	type ActivityBatchSummary
} from './activity-display';
import { ActivityIcon, ActivityProgressView, ActivitySymbol } from './activity-swiftui';
import { useActivitiesScreen, type ActivitiesScreenModel } from './use-activities';

const tertiary = { type: 'hierarchical', style: 'tertiary' } as const;

function ActivityBatchRow({ batch }: { batch: ActivityBatchSummary }) {
	const status = ActivityBatch.status(batch);
	const title = ActivityBatch.displayTitle(batch);
	const completed = ActivityBatch.completedCount(batch);
	const failed = ActivityBatch.failedCount(batch);
	const environmentLabel = ActivityBatch.environmentLabel(batch);
	return (
		<HStack
			alignment="top"
			spacing={12}
			modifiers={[
				padding({ vertical: 4 }),
				accessibilityElement('combine'),
				accessibilityLabel(
					`${title}, ${status}, ${completed} of ${batch.activities.length} completed`
				),
				accessibilityHint('Expands related activities')
			]}
		>
			<ActivitySymbol systemName="square.stack.3d.up.fill" tint={activityStatusTint(status)} />
			<VStack alignment="leading" spacing={6}>
				<HStack alignment="firstTextBaseline" spacing={8}>
					<Text modifiers={[font({ textStyle: 'body' })]}>{title}</Text>
					<Spacer minLength={0} />
					<ResourceStatusBadge status={status} />
				</HStack>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{`${completed} of ${batch.activities.length} completed`}
				</Text>
				{failed > 0 ? (
					<Text
						modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(systemColors.red)]}
					>{`${failed} failed`}</Text>
				) : null}
				<ActivityProgressView
					progress={ActivityBatch.progress(batch)}
					isActive={ActivityBatch.isActive(batch)}
					tint={activityStatusTint(status)}
				/>
				<HStack spacing={6} modifiers={[font({ textStyle: 'caption' }), foregroundStyle(tertiary)]}>
					<Text>{relativeNamed(ActivityBatch.startedAt(batch))}</Text>
					{environmentLabel !== undefined ? (
						<>
							<Text>-</Text>
							<Text>{environmentLabel}</Text>
						</>
					) : null}
				</HStack>
			</VStack>
		</HStack>
	);
}

function ActivityBatchMemberRow({ activity }: { activity: Activity }) {
	const source = activity.sourceEnvironmentName;
	return (
		<HStack
			alignment="top"
			spacing={10}
			modifiers={[padding({ vertical: 2 }), accessibilityElement('combine')]}
		>
			<ActivityIcon activity={activity} />
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'body' })]}>
					{ActivityDisplay.displayTitle(activity)}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{ActivityDisplay.subtitle(activity)}
				</Text>
				{ActivityDisplay.isCancellable(activity) ? (
					<ActivityProgressView
						progress={ActivityDisplay.displayProgress(activity)}
						isActive
						tint={ActivityDisplay.statusTint(activity)}
					/>
				) : null}
				{source !== undefined && source !== '' ? (
					<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(tertiary)]}>
						{source}
					</Text>
				) : null}
			</VStack>
			<Spacer minLength={0} />
			<ResourceStatusBadge status={activity.status} />
		</HStack>
	);
}

function ActivityRow({ activity }: { activity: Activity }) {
	const source = activity.sourceEnvironmentName;
	const title = ActivityDisplay.displayTitle(activity);
	const subtitle = ActivityDisplay.subtitle(activity);
	return (
		<HStack
			alignment="top"
			spacing={12}
			modifiers={[
				padding({ vertical: 4 }),
				accessibilityElement('combine'),
				accessibilityLabel(`${title}, ${activity.status}, ${subtitle}`)
			]}
		>
			<ActivityIcon activity={activity} />
			<VStack alignment="leading" spacing={6}>
				<HStack alignment="firstTextBaseline" spacing={8}>
					<Text modifiers={[font({ textStyle: 'body' })]}>{title}</Text>
					<Spacer minLength={0} />
					<ResourceStatusBadge status={activity.status} />
				</HStack>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{subtitle}
				</Text>
				{activity.latestMessage !== '' ? (
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(3)
						]}
					>
						{activity.latestMessage}
					</Text>
				) : null}
				{ActivityDisplay.isCancellable(activity) ? (
					<ActivityProgressView
						progress={ActivityDisplay.displayProgress(activity)}
						isActive
						tint={ActivityDisplay.statusTint(activity)}
					/>
				) : null}
				<HStack spacing={6} modifiers={[font({ textStyle: 'caption' }), foregroundStyle(tertiary)]}>
					<Text>{relativeNamed(dateMs(activity.startedAt))}</Text>
					{source !== undefined && source !== '' ? (
						<>
							<Text>-</Text>
							<Text>{source}</Text>
						</>
					) : null}
				</HStack>
			</VStack>
		</HStack>
	);
}

function ActivityLink({
	model,
	activity,
	children
}: {
	model: ActivitiesScreenModel;
	activity: Activity;
	children: ReactNode;
}) {
	return (
		<Button
			onPress={() => model.openActivity(activity)}
			modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
		>
			<HStack>
				{children}
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

type ActivitySegment =
	| { kind: 'activities'; key: string; activities: Activity[] }
	| { kind: 'batch'; key: string; batch: ActivityBatchSummary };

function activitySegments(items: ActivityCenterItem[]): ActivitySegment[] {
	const segments: ActivitySegment[] = [];
	let run: Activity[] | undefined;
	for (const item of items) {
		if (item.kind === 'activity') {
			if (run === undefined) {
				run = [];
				segments.push({
					kind: 'activities',
					key: `activities-${segments.length}`,
					activities: run
				});
			}
			run.push(item.activity);
		} else {
			run = undefined;
			segments.push({ kind: 'batch', key: ActivityCenterItem.id(item), batch: item.batch });
		}
	}
	return segments;
}

function ActivitySection({
	model,
	title,
	items,
	showsCount
}: {
	model: ActivitiesScreenModel;
	title: string;
	items: ActivityCenterItem[];
	showsCount: boolean;
}) {
	return (
		<Section
			header={
				showsCount ? (
					<ResourceCountSectionHeader
						title={title}
						loadedCount={model.countHeader.loadedCount}
						hasMore={model.countHeader.hasMore}
					/>
				) : (
					<Text>{title}</Text>
				)
			}
		>
			{activitySegments(items).map((segment) =>
				segment.kind === 'activities' ? (
					<List.ForEach
						key={segment.key}
						data={segment.activities}
						keyExtractor={activityItemKey}
						estimatedItemSize={96}
					>
						{({ item }) => (
							<ActivityLink model={model} activity={item}>
								<ActivityRow activity={item} />
							</ActivityLink>
						)}
					</List.ForEach>
				) : (
					<DisclosureGroup
						key={segment.key}
						isExpanded={model.isExpanded(segment.batch.id)}
						onIsExpandedChange={(expanded) => model.setExpanded(segment.batch.id, expanded)}
					>
						<DisclosureGroup.Label>
							<ActivityBatchRow batch={segment.batch} />
						</DisclosureGroup.Label>
						{segment.batch.activities.map((activity) => (
							<ActivityLink
								key={`${ActivityDisplay.sourceEnvironmentKey(activity)}-${activity.id}`}
								model={model}
								activity={activity}
							>
								<ActivityBatchMemberRow activity={activity} />
							</ActivityLink>
						))}
					</DisclosureGroup>
				)
			)}
		</Section>
	);
}

function ActivitiesToolbar({ model }: { model: ActivitiesScreenModel }) {
	const accent = useAccentColor();
	const { state } = model;
	const actions = model.store.getState();
	if (!model.supportsActivities) return null;
	return (
		<AppToolbar placement="right" tintColor={accent}>
			<Stack.Toolbar.Menu
				icon={
					model.activeFilterCount === 0
						? 'line.3.horizontal.decrease.circle'
						: 'line.3.horizontal.decrease.circle.fill'
				}
				accessibilityLabel="Filter activities"
			>
				<Stack.Toolbar.Menu title="Status">
					{ActivityStatusFilter.allCases.map((filter) => (
						<Stack.Toolbar.MenuAction
							key={filter}
							icon={ActivityStatusFilter.systemImage(filter) as SFSymbol}
							isOn={state.statusFilter === filter}
							onPress={() => actions.setStatusFilter(filter)}
						>
							{ActivityStatusFilter.title(filter)}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
				<Stack.Toolbar.Menu title="Type">
					<Stack.Toolbar.MenuAction
						isOn={state.typeFilter === ''}
						onPress={() => actions.setTypeFilter('')}
					>
						All Types
					</Stack.Toolbar.MenuAction>
					{state.availableTypes.map((type) => (
						<Stack.Toolbar.MenuAction
							key={type}
							isOn={state.typeFilter === type}
							onPress={() => actions.setTypeFilter(type)}
						>
							{activityDisplayName(type)}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
				<Stack.Toolbar.Menu title="Resource">
					<Stack.Toolbar.MenuAction
						isOn={state.resourceFilter === ''}
						onPress={() => actions.setResourceFilter('')}
					>
						All Resources
					</Stack.Toolbar.MenuAction>
					{state.availableResourceTypes.map((resource) => (
						<Stack.Toolbar.MenuAction
							key={resource}
							isOn={state.resourceFilter === resource}
							onPress={() => actions.setResourceFilter(resource)}
						>
							{activityDisplayName(resource)}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
				{model.activeFilterCount > 0 ? (
					<Stack.Toolbar.Menu inline>
						<Stack.Toolbar.MenuAction icon="xmark.circle" onPress={model.clearFilters}>
							Clear Filters
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
				) : null}
			</Stack.Toolbar.Menu>
			<Stack.Toolbar.Button
				icon="arrow.clockwise"
				accessibilityLabel="Refresh"
				disabled={state.isLoading}
				onPress={() => void model.retry()}
			/>
			{model.canClearHistory ? (
				<Stack.Toolbar.Button
					icon="trash"
					tintColor={systemColors.red}
					accessibilityLabel="Clear history"
					disabled={state.activities.length === 0}
					onPress={model.requestClear}
				/>
			) : null}
		</AppToolbar>
	);
}

export function ActivitiesScreen({
	onDone,
	initialStatusFilter
}: { onDone?: () => void; initialStatusFilter?: ActivityStatusFilter } = {}) {
	const model = useActivitiesScreen(initialStatusFilter);
	const { state } = model;

	let content;
	if (!model.supportsActivities) {
		content = (
			<ContentUnavailableView
				title="Requires Arcane v2"
				systemImage="clock.arrow.circlepath"
				description="Activity Center is available when connected to an Arcane 2.0 server."
			/>
		);
	} else if (state.isLoading && state.activities.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading activities..." />
			</VStack>
		);
	} else if (state.errorMessage !== undefined && state.activities.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Activities"
				systemImage="exclamationmark.triangle"
				description={state.errorMessage}
				actions={[{ title: 'Retry', onPress: () => void model.retry() }]}
			/>
		);
	} else if (state.activities.length === 0) {
		content = (
			<ContentUnavailableView
				title="No Activities"
				systemImage="clock.arrow.circlepath"
				description="Background work from your environments will appear here."
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.retry)]}>
				{state.streamErrorMessage !== undefined ? (
					<Section>
						<ErrorBanner
							message={state.streamErrorMessage}
							severity="warning"
							retry={() => void model.retry()}
						/>
					</Section>
				) : null}
				{state.runningItems.length === 0 && state.historyItems.length === 0 ? (
					<ContentUnavailableView
						title="No Matching Activities"
						systemImage="line.3.horizontal.decrease.circle"
						description="Adjust the filters or search text."
					/>
				) : (
					<>
						{state.runningItems.length > 0 ? (
							<ActivitySection
								model={model}
								title="Running"
								items={state.runningItems}
								showsCount
							/>
						) : null}
						{state.historyItems.length > 0 ? (
							<ActivitySection
								model={model}
								title="History"
								items={state.historyItems}
								showsCount={state.runningItems.length === 0}
							/>
						) : null}
						<PaginatedListFooter
							hasMore={state.hasMore && state.searchText === ''}
							loadMoreError={state.loadMoreError}
							onRetry={model.retryLoadMore}
							onLoadMore={model.loadMore}
						/>
					</>
				)}
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Activities',
					headerSearchBarOptions: {
						placeholder: 'Search activities',
						placement: 'stacked',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			{onDone ? (
				<AppToolbar placement="left">
					<Stack.Toolbar.Button onPress={onDone}>Done</Stack.Toolbar.Button>
				</AppToolbar>
			) : null}
			<ActivitiesToolbar model={model} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
