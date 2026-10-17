import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { Activity } from '@/sdk/models/activity/Activity';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ErrorBanner } from '@/ui/components/error-banner';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import {
	ActivityBatch,
	ActivityCenterItem,
	ActivityDisplay,
	ActivityStatusFilter,
	activityDisplayName,
	activityStatusTint,
	dateMs,
	relativeNamed,
	type ActivityBatchSummary
} from './activity-display';
import {
	ActivityIcon,
	ActivityProgressView,
	ActivitySymbol,
	ActivityToolbar,
	EmptyState,
	type ActivityToolbarItem
} from './activity-material';
import { useActivitiesScreen, type ActivitiesScreenModel } from './use-activities';

function Divider() {
	return <View style={{ height: 1, marginLeft: 56, backgroundColor: colors.separator }} />;
}

function Caption({ parts }: { parts: (string | undefined)[] }) {
	const text = parts
		.filter((part): part is string => part !== undefined && part !== '')
		.join(' - ');
	return <Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel }]}>{text}</Text>;
}

function ActivityRow({ activity }: { activity: Activity }) {
	return (
		<>
			<ActivityIcon activity={activity} />
			<View style={{ flex: 1, gap: 6 }}>
				<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
					<Text style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}>
						{ActivityDisplay.displayTitle(activity)}
					</Text>
					<ResourceStatusBadge status={activity.status} />
				</View>
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
					{ActivityDisplay.subtitle(activity)}
				</Text>
				{activity.latestMessage !== '' ? (
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
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
				<Caption
					parts={[relativeNamed(dateMs(activity.startedAt)), activity.sourceEnvironmentName]}
				/>
			</View>
		</>
	);
}

function ActivityBatchMemberRow({ activity }: { activity: Activity }) {
	const source = activity.sourceEnvironmentName;
	return (
		<>
			<ActivityIcon activity={activity} />
			<View style={{ flex: 1, gap: 4 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>
					{ActivityDisplay.displayTitle(activity)}
				</Text>
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
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
					<Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel }]}>{source}</Text>
				) : null}
			</View>
			<ResourceStatusBadge status={activity.status} />
		</>
	);
}

function RowPressable({
	onPress,
	accessibilityLabel,
	accessibilityHint,
	inset = 0,
	children
}: {
	onPress: () => void;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	inset?: number;
	children: ReactNode;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'flex-start',
				gap: 12,
				paddingLeft: 16 + inset,
				paddingRight: 16,
				paddingVertical: 12
			}}
		>
			{children}
		</Pressable>
	);
}

function BatchItem({
	model,
	batch
}: {
	model: ActivitiesScreenModel;
	batch: ActivityBatchSummary;
}) {
	const expanded = model.isExpanded(batch.id);
	const status = ActivityBatch.status(batch);
	const title = ActivityBatch.displayTitle(batch);
	const completed = ActivityBatch.completedCount(batch);
	const failed = ActivityBatch.failedCount(batch);
	return (
		<>
			<Pressable
				onPress={() => model.setExpanded(batch.id, !expanded)}
				accessibilityRole="button"
				accessibilityState={{ expanded }}
				accessibilityLabel={`${title}, ${status}, ${completed} of ${batch.activities.length} completed`}
				accessibilityHint="Expands related activities"
				android_ripple={{ color: colors.separator as string }}
				style={{
					flexDirection: 'row',
					alignItems: 'flex-start',
					gap: 12,
					paddingHorizontal: 16,
					paddingVertical: 12
				}}
			>
				<ActivitySymbol systemName="square.stack.3d.up.fill" tint={activityStatusTint(status)} />
				<View style={{ flex: 1, gap: 6 }}>
					<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
						<Text style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}>{title}</Text>
						<ResourceStatusBadge status={status} />
					</View>
					<Text
						style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}
					>{`${completed} of ${batch.activities.length} completed`}</Text>
					{failed > 0 ? (
						<Text
							style={[m3Type.bodyMedium, { color: systemColors.red }]}
						>{`${failed} failed`}</Text>
					) : null}
					<ActivityProgressView
						progress={ActivityBatch.progress(batch)}
						isActive={ActivityBatch.isActive(batch)}
						tint={activityStatusTint(status)}
					/>
					<Caption
						parts={[
							relativeNamed(ActivityBatch.startedAt(batch)),
							ActivityBatch.environmentLabel(batch)
						]}
					/>
				</View>
				<Icon
					name={expanded ? 'chevron.up' : 'chevron.down'}
					size={20}
					color={colors.secondaryLabel}
				/>
			</Pressable>
			{expanded
				? batch.activities.map((activity) => (
						<View key={`${ActivityDisplay.sourceEnvironmentKey(activity)}-${activity.id}`}>
							<Divider />
							<RowPressable onPress={() => model.openActivity(activity)} inset={24}>
								<ActivityBatchMemberRow activity={activity} />
							</RowPressable>
						</View>
					))
				: null}
		</>
	);
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
		<View>
			{showsCount ? (
				<ResourceCountSectionHeader
					title={title}
					loadedCount={model.state.filteredActivityCount}
					hasMore={model.state.hasMore}
				/>
			) : (
				<MaterialSectionHeader title={title} />
			)}
			<MaterialListGroup>
				{items.map((item, index) => (
					<View key={ActivityCenterItem.id(item)}>
						{index > 0 ? <Divider /> : null}
						{item.kind === 'activity' ? (
							<RowPressable onPress={() => model.openActivity(item.activity)}>
								<ActivityRow activity={item.activity} />
							</RowPressable>
						) : (
							<BatchItem model={model} batch={item.batch} />
						)}
					</View>
				))}
			</MaterialListGroup>
		</View>
	);
}

function toolbarItems(model: ActivitiesScreenModel): ActivityToolbarItem[] {
	if (!model.supportsActivities) return [];
	const { state } = model;
	const actions = model.store.getState();
	const filterEntries = [
		{
			id: 'status',
			title: 'Status',
			children: ActivityStatusFilter.allCases.map((filter) => ({
				id: `status:${filter}`,
				title: ActivityStatusFilter.title(filter),
				checked: state.statusFilter === filter,
				onPress: () => actions.setStatusFilter(filter)
			}))
		},
		{
			id: 'type',
			title: 'Type',
			children: [
				{
					id: 'type:',
					title: 'All Types',
					checked: state.typeFilter === '',
					onPress: () => actions.setTypeFilter('')
				},
				...state.availableTypes.map((type) => ({
					id: `type:${type}`,
					title: activityDisplayName(type),
					checked: state.typeFilter === type,
					onPress: () => actions.setTypeFilter(type)
				}))
			]
		},
		{
			id: 'resource',
			title: 'Resource',
			children: [
				{
					id: 'resource:',
					title: 'All Resources',
					checked: state.resourceFilter === '',
					onPress: () => actions.setResourceFilter('')
				},
				...state.availableResourceTypes.map((resource) => ({
					id: `resource:${resource}`,
					title: activityDisplayName(resource),
					checked: state.resourceFilter === resource,
					onPress: () => actions.setResourceFilter(resource)
				}))
			]
		},
		...(model.activeFilterCount > 0
			? [{ id: 'clear', title: 'Clear Filters', onPress: model.clearFilters }]
			: [])
	];
	const items: ActivityToolbarItem[] = [
		{
			kind: 'menu',
			id: 'filter',
			icon:
				model.activeFilterCount === 0
					? 'line.3.horizontal.decrease.circle'
					: 'line.3.horizontal.decrease.circle.fill',
			label: 'Filter activities',
			entries: filterEntries
		},
		{
			kind: 'button',
			id: 'refresh',
			icon: 'arrow.clockwise',
			label: 'Refresh',
			disabled: state.isLoading,
			onPress: () => void model.retry()
		}
	];
	if (model.canClearHistory) {
		items.push({
			kind: 'button',
			id: 'clear-history',
			icon: 'trash',
			label: 'Clear history',
			color: systemColors.red,
			disabled: state.activities.length === 0,
			onPress: model.requestClear
		});
	}
	return items;
}

export function ActivitiesScreen(_props: { onDone?: () => void } = {}) {
	const model = useActivitiesScreen();
	const { state } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await model.retry();
		} finally {
			setRefreshing(false);
		}
	};

	let content: ReactNode;
	let scrollable = false;
	if (!model.supportsActivities) {
		content = (
			<EmptyState
				icon="clock.arrow.circlepath"
				title="Requires Arcane v2"
				message="Activity Center is available when connected to an Arcane 2.0 server."
			/>
		);
	} else if (state.isLoading && state.activities.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading activities..." />
			</View>
		);
	} else if (state.errorMessage !== undefined && state.activities.length === 0) {
		content = (
			<EmptyState
				icon="exclamationmark.triangle"
				title="Couldn't Load Activities"
				message={state.errorMessage}
				action={{ title: 'Retry', onPress: () => void model.retry() }}
			/>
		);
	} else if (state.activities.length === 0) {
		content = (
			<EmptyState
				icon="clock.arrow.circlepath"
				title="No Activities"
				message="Background work from your environments will appear here."
			/>
		);
	} else {
		scrollable = true;
		content = (
			<>
				{state.streamErrorMessage !== undefined ? (
					<View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
						<ErrorBanner
							message={state.streamErrorMessage}
							severity="warning"
							retry={() => void model.retry()}
						/>
					</View>
				) : null}
				{state.runningItems.length === 0 && state.historyItems.length === 0 ? (
					<EmptyState
						icon="line.3.horizontal.decrease.circle"
						title="No Matching Activities"
						message="Adjust the filters or search text."
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
			</>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Activities',
					headerSearchBarOptions: {
						placeholder: 'Search activities',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<ActivityToolbar items={toolbarItems(model)} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					scrollable ? (
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => void onRefresh()}
							colors={[systemColors.blue]}
						/>
					) : undefined
				}
			>
				{content}
			</ScrollView>
		</>
	);
}
