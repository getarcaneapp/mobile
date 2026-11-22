import { titleCasedWords } from '@/core/title-case';
import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	Divider,
	HStack,
	Label,
	List,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	padding,
	refreshable,
	shapes,
	tint,
	contentShape
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import type { Event } from '@/sdk/models/event/Event';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { EventSeverityFilter } from './events-store';
import {
	relativeNamed,
	severityCount,
	severityIcon,
	severityTint,
	useEvents,
	type EventsModel
} from './use-events';
import { eventRedundantDescription, readableEventText } from './event-text';

const countTitle = (title: string, count: number | undefined) =>
	count === undefined ? title : `${title} (${count.toLocaleString()})`;

function EventRow({ event }: { event: Event }) {
	const meta =
		event.type !== ''
			? `${relativeNamed(event.timestamp)} · ${titleCasedWords(event.type)}`
			: relativeNamed(event.timestamp);
	return (
		<HStack alignment="top" spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<RowIcon systemImage={severityIcon(event.severity)} tint={severityTint(event.severity)} />
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'body' }), lineLimit(2)]}>
					{readableEventText(event.title)}
				</Text>
				{eventRedundantDescription(event) ? null : (
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(2)
						]}
					>
						{readableEventText(event.description ?? '')}
					</Text>
				)}
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					{meta}
				</Text>
			</VStack>
			<Spacer minLength={0} />
		</HStack>
	);
}

function EventLink({ model, event }: { model: EventsModel; event: Event }) {
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Trigger>
					<Button
						onPress={() => model.openDetail(event)}
						modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
					>
						<HStack>
							<EventRow event={event} />
							<DisclosureChevron />
						</HStack>
					</Button>
				</ContextMenu.Trigger>
				<ContextMenu.Items>
					<Button onPress={() => model.copyTitle(event)}>
						<Label title="Copy Title" systemImage="doc.on.doc" />
					</Button>
					{event.description ? (
						<Button onPress={() => model.copyDescription(event)}>
							<Label title="Copy Description" systemImage="doc.on.doc.fill" />
						</Button>
					) : null}
					{model.canDeleteEvents ? (
						<>
							<Divider />
							<Button
								role="destructive"
								onPress={() => model.requestDelete(event)}
								modifiers={[tint(systemColors.red)]}
							>
								<DestructiveLabel text="Delete Event" />
							</Button>
						</>
					) : null}
				</ContextMenu.Items>
			</ContextMenu>
			<SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
				<Button
					label="Copy"
					systemImage="doc.on.doc"
					onPress={() => model.copyTitle(event)}
					modifiers={[tint(systemColors.blue)]}
				/>
			</SwipeActions.Actions>
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				{model.canDeleteEvents ? (
					<Button
						role="destructive"
						label="Delete"
						systemImage="trash"
						onPress={() => model.requestDelete(event)}
						modifiers={[disabled(model.snapshot.deletingEventIDs.has(event.id))]}
					/>
				) : null}
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function EventsScreen() {
	const model = useEvents();
	const { snapshot } = model;
	const accent = useAccentColor();
	const liveIcon = model.isLive ? 'dot.radiowaves.left.and.right' : 'pause.circle';
	const selected = snapshot.selectedSeverities;
	const isFiltered = selected.size > 0;
	const filterIcon = isFiltered
		? 'line.3.horizontal.decrease.circle.fill'
		: 'line.3.horizontal.decrease.circle';
	const counts =
		snapshot.supportsSeverityCounts && snapshot.severityCounts
			? snapshot.severityCounts
			: undefined;
	const icon = useToolbarIcons([liveIcon, filterIcon]);

	let content;
	if (snapshot.isLoading && snapshot.events.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading events…" />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && snapshot.events.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Events"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
				actions={[{ title: 'Retry', onPress: () => void model.store.reload() }]}
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
				{snapshot.events.length === 0 ? (
					<ContentUnavailableView
						title={model.emptyTitle}
						systemImage="clock.badge.exclamationmark"
					/>
				) : (
					<Section
						header={
							<ResourceCountSectionHeader
								title="Events"
								loadedCount={snapshot.events.length}
								totalCount={snapshot.totalItemCount}
								hasMore={snapshot.hasMore}
							/>
						}
					>
						<List.ForEach
							data={snapshot.events}
							keyExtractor={stableItemKey}
							estimatedItemSize={66}
						>
							{({ item }) => <EventLink model={model} event={item} />}
						</List.ForEach>
					</Section>
				)}
				{snapshot.errorMessage !== undefined && snapshot.events.length > 0 ? (
					<Section>
						<Label
							title={snapshot.errorMessage}
							systemImage="exclamationmark.triangle"
							modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(systemColors.red)]}
						/>
					</Section>
				) : null}
				<PaginatedListFooter
					hasMore={snapshot.hasMore}
					loadMoreError={snapshot.loadMoreError}
					onRetry={() => void model.store.loadMore()}
					onLoadMore={() => {
						if (snapshot.isLoading || snapshot.isLoadingMore) return;
						void model.store.loadMore();
					}}
				/>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Events',
					headerSearchBarOptions: {
						placeholder: 'Search events',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<AppToolbar placement="right" tintColor={accent}>
				<Stack.Toolbar.Menu
					icon={icon(filterIcon)}
					accessibilityLabel={isFiltered ? 'Filter, active' : 'Filter'}
				>
					<Stack.Toolbar.MenuAction
						icon="tray.full"
						isOn={!isFiltered}
						onPress={model.store.clearSeverities}
					>
						{countTitle('All Events', counts?.total)}
					</Stack.Toolbar.MenuAction>
					<Stack.Toolbar.Menu inline title="Severity">
						{EventSeverityFilter.allCases.map((severity) => (
							<Stack.Toolbar.MenuAction
								key={severity}
								icon={EventSeverityFilter.icon[severity] as never}
								isOn={selected.has(severity)}
								onPress={() => model.store.toggle(severity)}
							>
								{countTitle(
									EventSeverityFilter.title[severity],
									counts ? severityCount(counts, severity) : undefined
								)}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar.Menu>
				<Stack.Toolbar.Button
					icon={icon(liveIcon)}
					accessibilityLabel={model.isLive ? 'Pause live events' : 'Resume live events'}
					onPress={model.toggleLive}
				/>
			</AppToolbar>
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
