import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { SwarmServiceSummary } from '@/sdk/models/swarm/SwarmServices';
import { colors, systemColors } from '@/theme/colors';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { ResourceCountLabel } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { ImageReferenceLine, RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';
import { SectionTitle, SheetError } from '@/features/networks/android-parts';

import { SwarmListState } from './swarm-parts';
import {
	serviceIsHealthy,
	serviceModeTitle,
	useSwarmScale,
	useSwarmServices,
	type SwarmServicesModel
} from './use-swarm-services';

const serviceRowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	flex: 1
};
const serviceBodyStyle = { flex: 1, gap: 3 };
const stackLineStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 };
const replicasStyle = { alignItems: 'flex-end' as const, gap: 3 };
const listRowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	paddingHorizontal: 16,
	paddingVertical: 10
};
const listContentStyle = { paddingBottom: 32 };

export function SwarmServiceRow({
	service,
	showsStack = true
}: {
	service: SwarmServiceSummary;
	showsStack?: boolean;
}) {
	const healthy = serviceIsHealthy(service);
	return (
		<View style={serviceRowStyle}>
			<RowIcon systemImage="shippingbox.fill" tint={healthy ? undefined : systemColors.orange} />
			<View style={serviceBodyStyle}>
				<Text numberOfLines={1} style={[m3Type.bodyLarge, { color: colors.label }]}>
					{service.name}
				</Text>
				<ImageReferenceLine reference={service.image} />
				{showsStack && service.stackName ? (
					<View style={stackLineStyle}>
						<Icon name="square.stack.3d.up" size={11} color={colors.secondaryLabel} />
						<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
							{service.stackName}
						</Text>
					</View>
				) : null}
			</View>
			<View style={replicasStyle}>
				<Text
					style={[
						m3Type.titleSmall,
						{
							color: healthy ? systemColors.green : systemColors.orange,
							fontVariant: ['tabular-nums']
						}
					]}
				>
					{`${service.runningReplicas}/${service.replicas}`}
				</Text>
				<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
					{serviceModeTitle(service)}
				</Text>
			</View>
		</View>
	);
}

function ServiceListRow({
	model,
	service
}: {
	model: SwarmServicesModel;
	service: SwarmServiceSummary;
}) {
	const items: RowMenuItem[] = [];
	if (model.canManage && service.mode === 'replicated')
		items.push({ id: 'scale', title: 'Scale', onPress: () => model.openScale(service) });
	if (model.canReadLogs)
		items.push({ id: 'logs', title: 'Logs', onPress: () => model.openLogs(service) });
	if (model.canManage)
		items.push({
			id: 'delete',
			title: 'Delete',
			destructive: true,
			onPress: () => model.requestDelete(service)
		});
	return (
		<LongPressMenu
			title={service.name}
			items={items}
			onPress={() => model.openDetail(service)}
			style={listRowStyle}
		>
			<SwarmServiceRow service={service} showsStack={model.showsStack} />
		</LongPressMenu>
	);
}

export function SwarmServicesList({ model }: { model: SwarmServicesModel }) {
	const { snapshot, items } = model;
	const [refreshing, setRefreshing] = useState(false);
	return (
		<SwarmListState
			isLoading={snapshot.isLoading}
			isEmpty={items.length === 0}
			errorMessage={snapshot.errorMessage}
			emptyTitle={model.emptyTitle}
			emptySystemImage="shippingbox"
			retry={() => void model.load()}
		>
			<GroupedFlashList
				data={items.map((item, index) => ({
					key: String(item.id),
					type: 'item',
					service: item.value,
					grouped: groupPosition(index, items.length)
				}))}
				renderEntry={(entry) => <ServiceListRow model={model} service={entry.service} />}
				header={
					<SectionTitle
						title="Services"
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
	);
}

export function EmbeddedSwarmServices({
	environmentID,
	stackName
}: {
	environmentID: EnvironmentID;
	stackName: string;
}) {
	const model = useSwarmServices(environmentID, stackName);
	return <SwarmServicesList model={model} />;
}

export function SwarmServicesScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useSwarmServices(envID);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Services',
					headerSearchBarOptions: {
						placeholder: 'Search services',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			{model.canManage ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'create',
							icon: 'plus',
							label: 'Create Service',
							onPress: model.openCreate
						}
					]}
				/>
			) : null}
			<SwarmServicesList model={model} />
		</>
	);
}

export function ReplicaStepper({
	value,
	onValueChange
}: {
	value: number;
	onValueChange: (value: number) => void;
}) {
	const button = (icon: string, label: string, delta: number, isDisabled: boolean) => (
		<Pressable
			onPress={() => onValueChange(value + delta)}
			disabled={isDisabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
			style={{
				width: 40,
				height: 40,
				alignItems: 'center',
				justifyContent: 'center',
				opacity: isDisabled ? 0.38 : 1
			}}
		>
			<Icon name={icon} size={22} color={m3.primary} />
		</Pressable>
	);
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				minHeight: 56,
				paddingHorizontal: 16,
				gap: 8
			}}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>Replicas</Text>
			<Text
				style={[m3Type.bodyLarge, { color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }]}
			>
				{String(value)}
			</Text>
			{button('minus', 'Decrement', -1, value <= 0)}
			{button('plus', 'Increment', 1, value >= 1000)}
		</View>
	);
}

export function SwarmScaleScreen() {
	const model = useSwarmScale();
	const service = model.service;
	return (
		<>
			<Stack.Screen
				options={{ title: `Scale ${service?.name ?? ''}`, gestureEnabled: !model.isSaving }}
			/>
			<AndroidToolbar
				placement="left"
				items={[
					{
						kind: 'button',
						id: 'cancel',
						icon: 'xmark',
						label: 'Cancel',
						disabled: model.isSaving,
						onPress: model.cancel
					}
				]}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'scale',
						icon: 'checkmark',
						label: 'Scale',
						disabled: !model.canScale,
						onPress: model.scale
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section
					footer={
						service ? `${service.runningReplicas} of ${service.replicas} running now.` : undefined
					}
				>
					<ReplicaStepper value={model.replicas} onValueChange={model.setReplicas} />
				</M3Section>
				<SheetError message={model.errorMessage} />
			</ScrollView>
		</>
	);
}
