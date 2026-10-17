import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	EnvironmentActionButton,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { ResourceCountLabel } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { StableSectionedList } from '@/ui/components/stable-sectioned-list';
import { Icon } from '@/ui/Icon';

import { CenteredMessage } from '@/features/containers/android-material';
import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';

import { useVolumesList, type VolumesListModel, type VolumesListProps } from './use-volumes-list';
import type { VolumeItem } from './volume-model';
import { VolumeRow } from './volume-row';
import { VolumesToolbar } from './volumes-toolbar';

function rowMenuItems(model: VolumesListModel, item: VolumeItem, isPinned: boolean): RowMenuItem[] {
	const items: RowMenuItem[] = [
		{ id: 'pin', title: isPinned ? 'Unpin' : 'Pin', onPress: () => model.togglePin(item) }
	];
	if (model.canRename(item))
		items.push({ id: 'rename', title: 'Rename', onPress: () => model.rename(item) });
	items.push({
		id: 'delete',
		title: 'Delete',
		destructive: true,
		onPress: () => model.requestDelete(item)
	});
	return items;
}

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

function VolumeListRow({ model, item }: { model: VolumesListModel; item: VolumeItem }) {
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
	const rowStyle = {
		flexDirection: 'row' as const,
		alignItems: 'center' as const,
		gap: 16,
		paddingHorizontal: 16,
		paddingVertical: 10
	};
	if (model.isSelecting) {
		const selected = model.selection.includes(item.id);
		return (
			<Pressable
				onPress={() => model.toggleSelected(item.id)}
				accessibilityRole="checkbox"
				accessibilityState={{ checked: selected }}
				android_ripple={{ color: colors.separator as string }}
				style={rowStyle}
			>
				<Checkbox checked={selected} />
				<View style={{ flex: 1 }}>{row}</View>
			</Pressable>
		);
	}
	return (
		<LongPressMenu
			items={rowMenuItems(model, item, isPinned)}
			title={item.value.name}
			onPress={() => model.openDetail(item)}
			style={rowStyle}
		>
			<View style={{ flex: 1 }}>{row}</View>
		</LongPressMenu>
	);
}

export function VolumesScreen(props: VolumesListProps) {
	const model = useVolumesList(props);
	const { snapshot, volumes } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await model.refresh();
		} finally {
			setRefreshing(false);
		}
	};

	let content;
	if (snapshot.isLoading && volumes.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && volumes.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Volumes"
				message={snapshot.errorMessage}
				action={{ title: 'Retry', onPress: () => void model.loadVolumes() }}
			/>
		);
	} else if (volumes.length === 0) {
		content = props.allEnvironments ? (
			<View style={{ flex: 1 }}>
				<CenteredMessage
					icon="externaldrive"
					title="No Volumes"
					message="No volumes found in any environment."
				/>
				<EnvironmentActionButton
					title="Create Volume"
					systemImage="plus"
					environments={model.createEnvironments}
					action={model.presentCreate}
				/>
			</View>
		) : (
			<CenteredMessage
				icon="externaldrive"
				title="No Volumes"
				message="No volumes found in this environment."
				action={{ title: 'Create Volume', onPress: () => model.presentCreate(props.environmentID) }}
			/>
		);
	} else {
		content = (
			<>
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
					renderRow={(item) => <VolumeListRow model={model} item={item} />}
				/>
				<PaginatedListFooter
					hasMore={snapshot.hasMore}
					loadMoreError={snapshot.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: model.isSelecting ? `${model.selection.length} selected` : 'Volumes',
					headerSearchBarOptions: {
						placeholder: 'Search volumes',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<VolumesToolbar model={model} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{content}
			</ScrollView>
		</>
	);
}
