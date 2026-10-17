/**
 * Port of `VolumesView` (VolumesView.swift).
 *
 * iOS: SwiftUI List with Pinned / Used / Unused sections, swipe actions,
 * context menus with previews, edit-mode selection, and native toolbar menus.
 */
import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { Button, ContextMenu, HStack, List, Spacer, SwipeActions, VStack } from '@expo/ui/swift-ui';
import {
	buttonStyle,
	environment,
	frame,
	listStyle,
	refreshable,
	tint,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import {
	EnvironmentActionButton,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { DestructiveLabel, ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowPreviewCard } from '@/ui/components/row-preview-card';
import { StableSectionedList } from '@/ui/components/stable-sectioned-list';
import { DisclosureChevron } from '@/ui/settings-row';

import { useEnvironmentRowColor } from '@/features/containers/hooks';

import { useVolumesList, type VolumesListModel, type VolumesListProps } from './use-volumes-list';
import { volumePreviewDetails, type VolumeItem } from './volume-model';
import { VolumeRow } from './volume-row';
import { VolumesToolbar } from './volumes-toolbar';

function VolumePreview({ model, item }: { model: VolumesListModel; item: VolumeItem }) {
	return (
		<RowPreviewCard
			icon="externaldrive.fill"
			iconColor={systemColors.orange}
			title={item.value.name}
			badges={[
				{
					text: item.value.inUse ? 'In Use' : 'Unused',
					color: item.value.inUse ? systemColors.green : systemColors.gray
				}
			]}
			details={volumePreviewDetails(item, model.size(item))}
		/>
	);
}

function VolumeLink({ model, item }: { model: VolumesListModel; item: VolumeItem }) {
	const isPinned = model.pinnedIDs.has(item.id);
	const environmentColor = useEnvironmentRowColor(item.environmentID, item.environmentName);
	const row = (
		<VolumeRow
			volume={item.value}
			size={model.size(item)}
			isPinned={isPinned}
			environmentName={item.environmentName}
			environmentColor={environmentColor}
		/>
	);
	if (model.isSelecting) return row;

	const pinLabel = isPinned ? 'Unpin' : 'Pin';
	const pinImage: SFSymbol = isPinned ? 'pin.slash.fill' : 'pin.fill';
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Trigger>
					<Button onPress={() => model.openDetail(item)} modifiers={[buttonStyle('plain')]}>
						<HStack modifiers={[contentShape(shapes.rectangle())]}>
							{row}
							<Spacer />
							<DisclosureChevron />
						</HStack>
					</Button>
				</ContextMenu.Trigger>
				<ContextMenu.Items>
					<Button label={pinLabel} systemImage={pinImage} onPress={() => model.togglePin(item)} />
					{model.canRename(item) ? (
						<Button label="Rename" systemImage="pencil" onPress={() => model.rename(item)} />
					) : null}
					<Button
						role="destructive"
						onPress={() => model.requestDelete(item)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Delete" />
					</Button>
				</ContextMenu.Items>
				<ContextMenu.Preview>
					<VolumePreview model={model} item={item} />
				</ContextMenu.Preview>
			</ContextMenu>
			<SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
				<Button
					label={pinLabel}
					systemImage={pinImage}
					onPress={() => model.togglePinAfterSwipe(item)}
					modifiers={[tint(systemColors.yellow)]}
				/>
			</SwipeActions.Actions>
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Delete"
					systemImage="trash"
					onPress={() => model.requestDelete(item)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function VolumesScreen(props: VolumesListProps) {
	const model = useVolumesList(props);
	const { snapshot, volumes } = model;

	let content;
	if (snapshot.isLoading && volumes.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && volumes.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Volumes"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
				actions={[{ title: 'Retry', onPress: () => void model.loadVolumes() }]}
			/>
		);
	} else if (volumes.length === 0) {
		content = (
			<UnavailableView
				title="No Volumes"
				systemImage="externaldrive"
				description={
					props.allEnvironments
						? 'No volumes found in any environment.'
						: 'No volumes found in this environment.'
				}
			>
				{props.allEnvironments ? (
					<EnvironmentActionButton
						title="Create Volume"
						systemImage="plus"
						environments={model.createEnvironments}
						action={model.presentCreate}
					/>
				) : (
					<Button label="Create Volume" onPress={() => model.presentCreate(props.environmentID)} />
				)}
			</UnavailableView>
		);
	} else {
		content = (
			<List
				selection={model.isSelecting ? model.selection : undefined}
				onSelectionChange={(selection) => {
					if (!model.isSelecting) return;
					const next = selection.map(String);
					for (const id of new Set([...next, ...model.selection])) {
						if (next.includes(id) !== model.selection.includes(id)) model.toggleSelected(id);
					}
				}}
				modifiers={[
					listStyle('insetGrouped'),
					environment('editMode', model.isSelecting ? 'active' : 'inactive'),
					refreshable(model.refresh)
				]}
			>
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.loadVolumes()}
				/>
				<StableSectionedList
					sections={model.sections}
					preferredHeaderAccessorySectionID="used"
					headerAccessory={() => (
						<ResourceCountLabel
							loadedCount={volumes.length}
							totalCount={snapshot.totalItems}
							hasMore={snapshot.hasMore}
						/>
					)}
					renderRow={(item) => <VolumeLink model={model} item={item} />}
				/>
				<PaginatedListFooter
					hasMore={snapshot.hasMore}
					loadMoreError={snapshot.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Volumes',
					headerSearchBarOptions: {
						placeholder: 'Search volumes',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<VolumesToolbar model={model} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
