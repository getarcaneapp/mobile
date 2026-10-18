import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { CenteredMessage } from '@/features/containers/android-material';
import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { LongPressMenu } from '@/features/containers/long-press-menu';
import { withCleanup } from '@/core/with-cleanup';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	EnvironmentActionButton,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { ResourceCountLabel } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { VirtualizedSectionedList } from '@/ui/components/virtualized-sectioned-list';
import { Icon } from '@/ui/Icon';

import { ImageRow } from './image-row';
import { ImagesToolbar } from './images-toolbar';
import {
	useImagesList,
	type ImageRowModel,
	type ImagesListModel,
	type ImagesListProps
} from './use-images-list';

function Checkbox({ checked }: { checked: boolean }) {
	return (
		<View
			style={{
				width: 20,
				height: 20,
				borderRadius: 2,
				borderWidth: 2,
				borderColor: checked ? m3.primary : m3.onSurfaceVariant,
				backgroundColor: checked ? m3.primary : 'transparent',
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			{checked ? <Icon name="checkmark" size={14} color={m3.onPrimary} /> : null}
		</View>
	);
}

const rowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	paddingHorizontal: 16,
	paddingVertical: 10
};

const rowContentStyle = { flex: 1 };

function ImageListRow({ model, row }: { model: ImagesListModel; row: ImageRowModel }) {
	const image = row.image;
	const environmentColor = useEnvironmentRowColor(image.environmentID, image.environmentName);
	const content = (
		<ImageRow
			row={row}
			environmentName={image.environmentName}
			environmentColor={environmentColor}
		/>
	);
	if (model.isSelecting) {
		const selected = model.selection.includes(row.id);
		return (
			<Pressable
				onPress={() => model.toggleSelected(row.id)}
				accessibilityRole="checkbox"
				accessibilityState={{ checked: selected }}
				android_ripple={{ color: colors.separator as string }}
				style={rowStyle}
			>
				<Checkbox checked={selected} />
				<View style={rowContentStyle}>{content}</View>
			</Pressable>
		);
	}
	return (
		<LongPressMenu
			items={[
				{
					id: 'delete',
					title: 'Delete',
					destructive: true,
					onPress: () => model.requestDelete(image)
				}
			]}
			title={row.displayName}
			onPress={() => model.openDetail(image)}
			style={rowStyle}
		>
			<View style={rowContentStyle}>{content}</View>
		</LongPressMenu>
	);
}

export function ImagesScreen(props: ImagesListProps) {
	const model = useImagesList(props);
	const { snapshot, images } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(model.refresh, () => setRefreshing(false));
	};

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={() => void onRefresh()}
			colors={[systemColors.blue]}
		/>
	);

	let content;
	if (snapshot.isLoading && images.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && images.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Error"
				message={snapshot.errorMessage}
				action={{ title: 'Retry', onPress: () => void model.loadImages() }}
			/>
		);
	} else if (images.length === 0) {
		content = (
			<View style={{ flex: 1 }}>
				<CenteredMessage
					icon="square.3.layers.3d.top.filled"
					title="No Images"
					message={
						props.allEnvironments
							? 'No images pulled to any environment yet.'
							: 'No images pulled to this environment yet.'
					}
					action={
						props.allEnvironments
							? undefined
							: { title: 'Pull Image', onPress: () => model.presentPull(props.environmentID) }
					}
				/>
				{props.allEnvironments ? (
					<View
						style={{
							backgroundColor: colors.systemGroupedBackground,
							paddingHorizontal: 16,
							paddingBottom: 32
						}}
					>
						<EnvironmentActionButton
							title="Pull Image"
							systemImage="arrow.down.circle"
							environments={model.listEnvironments}
							action={model.presentPull}
						/>
					</View>
				) : null}
			</View>
		);
	}

	const list =
		content === undefined ? (
			<VirtualizedSectionedList
				onEndReached={
					snapshot.hasMore && snapshot.loadMoreError === undefined
						? () => void model.loadMore()
						: undefined
				}
				sections={model.sections}
				preferredHeaderAccessorySectionID="used"
				headerAccessory={() => (
					<ResourceCountLabel
						loadedCount={images.length}
						totalCount={snapshot.totalItems}
						hasMore={snapshot.hasMore}
					/>
				)}
				renderRow={(row) => <ImageListRow model={model} row={row} />}
				header={
					<EnvironmentLoadFailuresSection
						failures={snapshot.failedEnvironments.map((failure) => ({
							...failure,
							id: failure.environment.id
						}))}
						retry={() => void model.loadImages()}
					/>
				}
				footer={
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
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
					title: model.isSelecting ? `${model.selection.length} selected` : 'Images',
					headerSearchBarOptions: {
						placeholder: 'Search images',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<ImagesToolbar model={model} />
			{list}
		</>
	);
}
