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
	ScrollView,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityLabel,
	background,
	buttonStyle,
	disabled,
	font,
	foregroundStyle,
	frame,
	listStyle,
	monospacedDigit,
	padding,
	refreshable,
	shapes,
	strokeBorder,
	tint,
	contentShape
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { Event, EventSeverityCounts } from '@/sdk/models/event/Event';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
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
	tintColor,
	isSelected,
	onPress
}: {
	title: string;
	count: number;
	icon: string;
	tintColor: 'primary' | (string & {});
	isSelected: boolean;
	onPress: () => void;
}) {
	const selectedFill = tintColor === 'primary' ? '#8E8E9326' : withOpacity(tintColor, 0.15);
	const selectedStroke = tintColor === 'primary' ? '#8E8E9373' : withOpacity(tintColor, 0.45);
	return (
		<Button
			onPress={onPress}
			modifiers={[
				buttonStyle('plain'),
				accessibilityElement('ignore'),
				accessibilityLabel(`${title}, ${count.toLocaleString()} events`),
				...(isSelected ? [accessibilityAddTraits(['isSelected'])] : [])
			]}
		>
			<HStack
				spacing={7}
				modifiers={[
					padding({ horizontal: 12, vertical: 9 }),
					background(
						isSelected ? selectedFill : '#8E8E9314',
						shapes.roundedRectangle({
							cornerRadius: Radius.standard,
							roundedCornerStyle: 'continuous'
						})
					),
					strokeBorder({
						color: isSelected ? selectedStroke : '#00000000',
						style: { lineWidth: 1 },
						shape: 'roundedRectangle',
						cornerRadius: Radius.standard
					})
				]}
			>
				<Image systemName={icon as SFSymbol} modifiers={[foregroundStyle(tintColor)]} />
				<VStack alignment="leading" spacing={1}>
					<Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>{title}</Text>
					<Text
						modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), monospacedDigit()]}
					>
						{count.toLocaleString()}
					</Text>
				</VStack>
			</HStack>
		</Button>
	);
}

function SeveritySummary({ model, counts }: { model: EventsModel; counts: EventSeverityCounts }) {
	const selected = model.snapshot.selectedSeverities;
	return (
		<ScrollView
			axes="horizontal"
			showsIndicators={false}
			modifiers={[accessibilityLabel('Event severity filters')]}
		>
			<HStack spacing={8} modifiers={[padding({ horizontal: 16 })]}>
				<SeverityChip
					title="Total"
					count={counts.total}
					icon="tray.full.fill"
					tintColor="primary"
					isSelected={selected.size === 0}
					onPress={model.store.clearSeverities}
				/>
				{EventSeverityFilter.allCases.map((severity) => (
					<SeverityChip
						key={severity}
						title={EventSeverityFilter.title[severity]}
						count={severityCount(counts, severity)}
						icon={EventSeverityFilter.icon[severity]}
						tintColor={severityFilterTint[severity]}
						isSelected={selected.has(severity)}
						onPress={() => model.store.toggle(severity)}
					/>
				))}
			</HStack>
		</ScrollView>
	);
}

function EventRow({ event }: { event: Event }) {
	return (
		<HStack alignment="top" spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<RowIcon systemImage={severityIcon(event.severity)} tint={severityTint(event.severity)} />
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'body' })]}>{event.title}</Text>
				{event.description ? (
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{event.description}
					</Text>
				) : null}
				<HStack spacing={6}>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
						]}
					>
						{relativeNamed(event.timestamp)}
					</Text>
					{event.type !== '' ? (
						<>
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
								]}
							>
								•
							</Text>
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
								]}
							>
								{titleCasedWords(event.type)}
							</Text>
						</>
					) : null}
				</HStack>
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
	const icon = useToolbarIcons([liveIcon]);

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
				{snapshot.supportsSeverityCounts && snapshot.severityCounts ? (
					<Section>
						<SeveritySummary model={model} counts={snapshot.severityCounts} />
					</Section>
				) : null}
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
