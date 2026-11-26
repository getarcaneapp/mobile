import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import type { Pod } from '@/sdk/models/podman/Pod';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';

import { CenteredMessage, M3Section, ValueRow } from '@/features/containers/android-material';
import {
	AndroidResourceActionsToolbar,
	AndroidToolbar
} from '@/features/containers/android-toolbar';
import { LongPressMenu } from '@/features/containers/long-press-menu';
import { SectionTitle } from '@/features/networks/android-parts';
import { CopyValueRow, SwarmKeyValueRows, SwarmListState } from '@/features/swarm/swarm-parts';

import { shortID } from './podman-common';
import { podmanStateVariant } from './podman-logic';
import { PodmanStateBadge } from './podman-state-badge';
import { usePodmanPodDetail, usePodmanPods, type PodmanPodsModel } from './use-podman-pods';

const rowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	paddingHorizontal: 16,
	paddingVertical: 10
};
const bodyStyle = { flex: 1, gap: 3 };
const listContentStyle = { paddingBottom: 32 };

function PodRow({ model, pod }: { model: PodmanPodsModel; pod: Pod }) {
	const stopped = podmanStateVariant(pod.status) === 'stopped';
	return (
		<LongPressMenu
			title={pod.name || shortID(pod.id)}
			items={model.menuActions(pod)}
			onPress={() => model.openDetail(pod)}
			style={rowStyle}
		>
			<RowIcon
				systemImage="circle.hexagongrid.fill"
				tint={stopped ? systemColors.gray : undefined}
			/>
			<View style={bodyStyle}>
				<Text numberOfLines={1} style={[m3Type.bodyLarge, { color: colors.label }]}>
					{pod.name || shortID(pod.id)}
				</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{model.containersText(pod)}
				</Text>
			</View>
			<PodmanStateBadge key={pod.id} state={pod.status} />
		</LongPressMenu>
	);
}

export function PodmanPodsScreen() {
	const model = usePodmanPods();
	const { snapshot, items } = model;
	const [refreshing, setRefreshing] = useState(false);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Pods',
					headerSearchBarOptions: {
						placeholder: 'Search pods',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			{model.canPrune ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'prune',
							icon: 'scissors',
							label: 'Prune Pods',
							onPress: model.requestPrune
						}
					]}
				/>
			) : null}
			<SwarmListState
				isLoading={snapshot.isLoading}
				isEmpty={items.length === 0}
				errorMessage={snapshot.errorMessage}
				emptyTitle={model.emptyTitle}
				emptySystemImage="circle.hexagongrid.fill"
				retry={() => void model.load()}
			>
				<GroupedFlashList
					data={items.map((item, index) => ({
						key: String(item.id),
						type: 'item',
						pod: item.value,
						grouped: groupPosition(index, items.length)
					}))}
					renderEntry={(entry) => <PodRow model={model} pod={entry.pod} />}
					header={
						<SectionTitle
							title="Pods"
							trailing={
								<ResourceCountLabel
									loadedCount={items.length}
									totalCount={snapshot.totalItems}
									hasMore={snapshot.hasMore}
								/>
							}
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
					onEndReached={
						snapshot.hasMore && snapshot.loadMoreError === undefined
							? () => void model.loadMore()
							: undefined
					}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => {
								setRefreshing(true);
								void model.load().finally(() => setRefreshing(false));
							}}
						/>
					}
					contentContainerStyle={listContentStyle}
				/>
			</SwarmListState>
		</>
	);
}

export function PodmanPodDetailScreen() {
	const model = usePodmanPodDetail();
	const { inspect } = model;
	const [refreshing, setRefreshing] = useState(false);
	let content;
	if (inspect) {
		content = (
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.load().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				<M3Section title="Overview">
					<View style={[rowStyle, { minHeight: 48 }]}>
						<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>State</Text>
						<PodmanStateBadge state={model.state} />
					</View>
					<CopyValueRow title="ID" value={inspect.id} />
					{inspect.infraContainerId ? (
						<CopyValueRow title="Infra Container" value={inspect.infraContainerId} />
					) : null}
					{model.overview.map((row) => (
						<ValueRow key={row.title} title={row.title} value={row.value} />
					))}
				</M3Section>
				<M3Section title={`Containers (${model.containers.length})`}>
					{model.containers.map((container) => (
						<View key={container.id} style={rowStyle}>
							<RowIcon
								systemImage={container.isInfra ? 'gearshape.fill' : 'cube.box.fill'}
								tint={container.isInfra ? systemColors.gray : undefined}
							/>
							<View style={bodyStyle}>
								<Text numberOfLines={1} style={[m3Type.bodyLarge, { color: colors.label }]}>
									{container.name || shortID(container.id)}
								</Text>
								{container.image ? (
									<Text
										numberOfLines={1}
										style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
									>
										{container.image}
									</Text>
								) : null}
							</View>
							<PodmanStateBadge state={container.state} />
						</View>
					))}
				</M3Section>
				{model.processes.length > 0 ? (
					<M3Section title="Processes" footer={model.processHeader}>
						{model.processes.map((process) => (
							<Text
								key={process.id}
								selectable
								numberOfLines={2}
								style={{
									fontFamily: monoFamily,
									fontSize: 12,
									color: colors.label,
									paddingHorizontal: 16,
									paddingVertical: 8
								}}
							>
								{process.text}
							</Text>
						))}
					</M3Section>
				) : null}
				{model.labels.length > 0 ? (
					<M3Section title="Labels">
						<SwarmKeyValueRows pairs={model.labels} />
					</M3Section>
				) : null}
			</ScrollView>
		);
	} else if (model.errorMessage !== undefined) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Pod"
				message={model.errorMessage}
				action={{ title: 'Try Again', onPress: () => void model.load() }}
			/>
		);
	} else {
		content = (
			<View
				style={{
					flex: 1,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: colors.systemGroupedBackground
				}}
			>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	}
	return (
		<>
			<Stack.Screen options={{ title: model.displayName }} />
			<AndroidResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				runningItemID={model.toolbar.runningItemID}
				isDisabled={model.toolbar.isDisabled}
				resourceName={model.displayName}
			/>
			{content}
		</>
	);
}
