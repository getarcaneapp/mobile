import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { Button, ContextMenu, HStack, List, SwipeActions, VStack } from '@expo/ui/swift-ui';
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

import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { secondaryHex, useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import {
	EnvironmentActionButton,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { DestructiveLabel, ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowPreviewCard } from '@/ui/components/row-preview-card';
import type { PreviewBadge, PreviewDetail } from '@/ui/components/row-preview-card.types';
import { StableSectionedList } from '@/ui/components/stable-sectioned-list';
import { DisclosureChevron } from '@/ui/settings-row';

import { ImageRow } from './image-row';
import { ImagesToolbar } from './images-toolbar';
import {
	useImagesList,
	type ImageRowModel,
	type ImagesListModel,
	type ImagesListProps
} from './use-images-list';

function ImagePreview({ row }: { row: ImageRowModel }) {
	const accent = useAccentColor();
	const isDark = useIsDark();
	const image = row.image;
	const badges: PreviewBadge[] = [
		{
			text: image.value.inUse ? 'In Use' : 'Unused',
			color: image.value.inUse ? systemColors.green : secondaryHex[isDark ? 'dark' : 'light']
		}
	];
	switch (row.updateState.kind) {
		case 'upToDate':
			badges.push({ text: 'Up to Date', color: systemColors.green });
			break;
		case 'hasUpdate':
			badges.push({ text: 'Update Available', color: accent });
			break;
		case 'error':
			badges.push({ text: 'Check Failed', color: systemColors.red });
			break;
		case 'unknown':
			break;
	}
	const details: PreviewDetail[] = [
		{ icon: 'internaldrive', label: 'Size', value: row.sizeText },
		{ icon: 'number', label: 'ID', value: image.value.id, monospaced: true }
	];
	if (image.environmentName)
		details.push({ icon: 'server.rack', label: 'Environment', value: image.environmentName });
	return (
		<RowPreviewCard
			icon="square.3.layers.3d.top.filled"
			iconColor={systemColors.purple}
			title={row.displayName}
			badges={badges}
			details={details}
		/>
	);
}

function ImageLink({ model, row }: { model: ImagesListModel; row: ImageRowModel }) {
	const image = row.image;
	const environmentColor = useEnvironmentRowColor(image.environmentID, image.environmentName);
	const content = (
		<ImageRow
			row={row}
			environmentName={image.environmentName}
			environmentColor={environmentColor}
		/>
	);
	if (model.isSelecting) return content;
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Trigger>
					<Button onPress={() => model.openDetail(image)} modifiers={[buttonStyle('plain')]}>
						<HStack modifiers={[contentShape(shapes.rectangle())]}>
							{content}
							<DisclosureChevron />
						</HStack>
					</Button>
				</ContextMenu.Trigger>
				<ContextMenu.Items>
					<Button
						role="destructive"
						onPress={() => model.requestDelete(image)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Delete" />
					</Button>
				</ContextMenu.Items>
				<ContextMenu.Preview>
					<ImagePreview row={row} />
				</ContextMenu.Preview>
			</ContextMenu>
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Delete"
					systemImage="trash"
					onPress={() => model.requestDelete(image)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function ImagesScreen(props: ImagesListProps) {
	const model = useImagesList(props);
	const { snapshot, images } = model;

	let content;
	if (snapshot.isLoading && images.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && images.length === 0) {
		content = (
			<UnavailableView
				title="Error"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
				actions={[{ title: 'Retry', onPress: () => void model.loadImages() }]}
			/>
		);
	} else if (images.length === 0) {
		content = (
			<UnavailableView
				title="No Images"
				systemImage="square.3.layers.3d.top.filled"
				description={
					props.allEnvironments
						? 'No images pulled to any environment yet.'
						: 'No images pulled to this environment yet.'
				}
			>
				{props.allEnvironments ? (
					<EnvironmentActionButton
						title="Pull Image"
						systemImage="arrow.down.circle"
						environments={model.listEnvironments}
						action={model.presentPull}
					/>
				) : (
					<Button label="Pull Image" onPress={() => model.presentPull(props.environmentID)} />
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
					retry={() => void model.loadImages()}
				/>
				<StableSectionedList
					sections={model.sections}
					preferredHeaderAccessorySectionID="used"
					headerAccessory={() => (
						<ResourceCountLabel
							loadedCount={images.length}
							totalCount={snapshot.totalItems}
							hasMore={snapshot.hasMore}
						/>
					)}
					renderRow={(row) => <ImageLink model={model} row={row} />}
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
					title: 'Images',
					headerSearchBarOptions: {
						placeholder: 'Search images',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<ImagesToolbar model={model} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
