import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { Event } from '@/sdk/models/event/Event';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	GroupedFlashList,
	groupPosition,
	type GroupedListEntry
} from '@/ui/components/grouped-flash-list';
import { ResourceCountLabel } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { CenteredMessage } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';
import { SectionTitle } from '@/features/networks/android-parts';

import { EventSeverityFilter } from './events-store';
import {
	relativeNamed,
	severityCount,
	severityFilterTint,
	severityIcon,
	severityTint,
	useEvents,
	type EventsModel
} from './use-events';

function SeverityChip({
	title,
	count,
	icon,
	tint,
	isSelected,
	onPress
}: {
	title: string;
	count: number;
	icon: string;
	tint?: string;
	isSelected: boolean;
	onPress: () => void;
}) {
	const color = tint ?? (colors.label as string);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${title}, ${count.toLocaleString()} events`}
			accessibilityState={{ selected: isSelected }}
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 7,
				paddingHorizontal: 12,
				paddingVertical: 9,
				borderRadius: Radius.standard,
				borderWidth: 1,
				borderColor: isSelected ? (tint ? withOpacity(tint, 0.45) : m3.outline) : 'transparent',
				backgroundColor: isSelected
					? tint
						? withOpacity(tint, 0.15)
						: m3.secondaryContainer
					: '#8E8E9314',
				overflow: 'hidden'
			}}
		>
			<Icon name={icon} size={18} color={color} />
			<View style={{ gap: 1 }}>
				<Text style={[m3Type.labelMedium, { color: colors.label }]}>{title}</Text>
				<Text style={[m3Type.titleSmall, { color: colors.label, fontVariant: ['tabular-nums'] }]}>
					{count.toLocaleString()}
				</Text>
			</View>
		</Pressable>
	);
}

function SeveritySummary({ model }: { model: EventsModel }) {
	const counts = model.snapshot.severityCounts;
	if (!model.snapshot.supportsSeverityCounts || !counts) return null;
	const selected = model.snapshot.selectedSeverities;
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}
		>
			<SeverityChip
				title="Total"
				count={counts.total}
				icon="tray.full.fill"
				isSelected={selected.size === 0}
				onPress={model.store.clearSeverities}
			/>
			{EventSeverityFilter.allCases.map((severity) => (
				<SeverityChip
					key={severity}
					title={EventSeverityFilter.title[severity]}
					count={severityCount(counts, severity)}
					icon={EventSeverityFilter.icon[severity]}
					tint={severityFilterTint[severity]}
					isSelected={selected.has(severity)}
					onPress={() => model.store.toggle(severity)}
				/>
			))}
		</ScrollView>
	);
}

const eventRowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'flex-start' as const,
	gap: 16,
	paddingHorizontal: 16,
	paddingVertical: 10
};
const eventBodyStyle = { flex: 1, gap: 4 };
const eventMetaStyle = { flexDirection: 'row' as const, gap: 6 };
const errorLineStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 8,
	paddingHorizontal: 32,
	paddingTop: 12
};

type EventEntry = GroupedListEntry & ({ type: 'header' } | { type: 'item'; event: Event });

function eventEntries(events: Event[]) {
	const entries: EventEntry[] = [{ type: 'header', key: 'header:events' }];
	events.forEach((event, index) => {
		entries.push({
			type: 'item',
			key: `event:${event.id}`,
			event,
			grouped: groupPosition(index, events.length)
		});
	});
	return entries;
}

function EventListRow({ model, event }: { model: EventsModel; event: Event }) {
	const items: RowMenuItem[] = [
		{ id: 'copy-title', title: 'Copy Title', onPress: () => model.copyTitle(event) }
	];
	if (event.description)
		items.push({
			id: 'copy-description',
			title: 'Copy Description',
			onPress: () => model.copyDescription(event)
		});
	if (model.canDeleteEvents) {
		items.push({
			id: 'delete',
			title: 'Delete Event',
			destructive: true,
			disabled: model.snapshot.deletingEventIDs.has(event.id),
			onPress: () => model.requestDelete(event)
		});
	}
	return (
		<LongPressMenu
			title={event.title}
			items={items}
			onPress={() => model.openDetail(event)}
			style={eventRowStyle}
		>
			<RowIcon systemImage={severityIcon(event.severity)} tint={severityTint(event.severity)} />
			<View style={eventBodyStyle}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{event.title}</Text>
				{event.description ? (
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						{event.description}
					</Text>
				) : null}
				<View style={eventMetaStyle}>
					<Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel }]}>
						{relativeNamed(event.timestamp)}
					</Text>
					{event.type !== '' ? (
						<>
							<Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel }]}>•</Text>
							<Text
								style={[m3Type.bodySmall, { color: colors.tertiaryLabel, fontFamily: monoFamily }]}
							>
								{event.type}
							</Text>
						</>
					) : null}
				</View>
			</View>
		</LongPressMenu>
	);
}

export function EventsScreen() {
	const model = useEvents();
	const { snapshot } = model;
	const [refreshing, setRefreshing] = useState(false);

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={() => {
				setRefreshing(true);
				void model.refresh().finally(() => setRefreshing(false));
			}}
			colors={[systemColors.blue]}
		/>
	);

	const footer = (
		<PaginatedListFooter
			hasMore={snapshot.hasMore}
			loadMoreError={snapshot.loadMoreError}
			onRetry={() => void model.store.loadMore()}
			onLoadMore={() => {
				if (snapshot.isLoading || snapshot.isLoadingMore) return;
				void model.store.loadMore();
			}}
		/>
	);

	let content;
	if (snapshot.isLoading && snapshot.events.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading events…" />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && snapshot.events.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Events"
				message={snapshot.errorMessage}
				action={{ title: 'Retry', onPress: () => void model.store.reload() }}
			/>
		);
	} else if (snapshot.events.length === 0) {
		content = (
			<>
				<SeveritySummary model={model} />
				<View style={{ flex: 1, minHeight: 320 }}>
					<CenteredMessage icon="clock.badge.exclamationmark" title={model.emptyTitle} message="" />
				</View>
				{footer}
			</>
		);
	}

	const list =
		content === undefined ? (
			<GroupedFlashList
				data={eventEntries(snapshot.events)}
				renderEntry={(entry) =>
					entry.type === 'header' ? (
						<SectionTitle
							title="Events"
							trailing={
								<ResourceCountLabel
									loadedCount={snapshot.events.length}
									totalCount={snapshot.totalItemCount}
									hasMore={snapshot.hasMore}
								/>
							}
						/>
					) : (
						<EventListRow model={model} event={entry.event} />
					)
				}
				header={<SeveritySummary model={model} />}
				footer={
					<>
						{snapshot.errorMessage !== undefined ? (
							<View style={errorLineStyle}>
								<Icon name="exclamationmark.triangle" size={16} color={m3.error} />
								<Text style={[m3Type.bodySmall, { color: m3.error, flex: 1 }]}>
									{snapshot.errorMessage}
								</Text>
							</View>
						) : null}
						{footer}
					</>
				}
				onEndReached={
					snapshot.hasMore && snapshot.loadMoreError === undefined
						? () => void model.store.loadMore()
						: undefined
				}
				refreshControl={refreshControl}
			/>
		) : (
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={refreshControl}
			>
				{content}
			</ScrollView>
		);

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Events',
					headerSearchBarOptions: {
						placeholder: 'Search events',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'live',
						icon: model.isLive ? 'dot.radiowaves.left.and.right' : 'pause.circle',
						label: model.isLive ? 'Pause live events' : 'Resume live events',
						onPress: model.toggleLive
					}
				]}
			/>
			{list}
		</>
	);
}
