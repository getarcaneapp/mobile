/** Android rendering of `PortsView` (PortsView.swift). */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { PortMapping } from '@/sdk/models/port/PortMapping';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	EnvironmentLabel,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { CenteredMessage } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { useEnvironmentRowColor } from '@/features/containers/hooks';

import {
	hostString,
	protocolTint,
	usePortsList,
	type PortItem,
	type PortsListProps
} from './use-ports-list';

function PortMappingRow({
	port,
	environmentName,
	environmentColor
}: {
	port: PortMapping;
	environmentName?: string;
	environmentColor?: string;
}) {
	const mono = { fontFamily: monoFamily, fontSize: 15, fontWeight: '600' as const };
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
			<RowIcon
				systemImage={port.isPublished ? 'arrow.left.arrow.right' : 'lock.fill'}
				tint={port.isPublished ? systemColors.green : systemColors.gray}
			/>
			<View style={{ flex: 1, gap: 3 }}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
					{port.hostPort !== undefined ? (
						<>
							<Text style={[mono, { color: colors.label }]}>{hostString(port)}</Text>
							<Icon name="arrow.right" size={11} color={colors.tertiaryLabel} />
							<Text style={[mono, { color: colors.secondaryLabel }]}>
								{String(port.containerPort)}
							</Text>
						</>
					) : (
						<>
							<Text style={[mono, { color: colors.label }]}>{String(port.containerPort)}</Text>
							<Text style={[m3Type.labelSmall, { color: colors.tertiaryLabel }]}>(internal)</Text>
						</>
					)}
				</View>
				<Text style={{ fontSize: 11, fontWeight: '700', color: protocolTint(port) }}>
					{port.protocolName.toUpperCase()}
				</Text>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</View>
			{port.isPublished ? (
				<Text
					style={{
						fontSize: 11,
						fontWeight: '700',
						color: systemColors.green,
						paddingHorizontal: 6,
						paddingVertical: 2,
						borderRadius: 999,
						overflow: 'hidden',
						backgroundColor: withOpacity(systemColors.green, 0.15)
					}}
				>
					PUB
				</Text>
			) : null}
		</View>
	);
}

function PortListRow({ port, onPress }: { port: PortItem; onPress: () => void }) {
	const environmentColor = useEnvironmentRowColor(port.environmentID, port.environmentName);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{ paddingHorizontal: 16, paddingVertical: 10 }}
		>
			<PortMappingRow
				port={port.value}
				environmentName={port.environmentName}
				environmentColor={environmentColor}
			/>
		</Pressable>
	);
}

export function PortsScreen(props: PortsListProps) {
	const model = usePortsList(props);
	const { snapshot, ports, sections } = model;
	const [refreshing, setRefreshing] = useState(false);

	let content;
	if (snapshot.isLoading && ports.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading ports…" />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && ports.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Ports"
				message={snapshot.errorMessage}
			/>
		);
	} else if (ports.length === 0) {
		content = (
			<CenteredMessage icon="point.3.connected.trianglepath.dotted" title="No Ports" message="" />
		);
	} else {
		content = (
			<>
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.load()}
				/>
				{sections.map((group, index) => (
					<View key={group.id}>
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 8,
								paddingHorizontal: 32,
								paddingTop: 20,
								paddingBottom: 6
							}}
						>
							<Icon name="shippingbox.fill" size={12} color={systemColors.blue} />
							<Text style={[m3Type.labelMedium, { color: colors.label }]}>{group.container}</Text>
							<Text
								style={[m3Type.labelSmall, { color: colors.tertiaryLabel }]}
							>{`(${group.ports.length})`}</Text>
							<View style={{ flex: 1 }} />
							{index === 0 ? (
								<ResourceCountLabel
									loadedCount={ports.length}
									totalCount={snapshot.totalItems}
									hasMore={snapshot.hasMore}
								/>
							) : null}
						</View>
						<MaterialListGroup>
							{group.ports.map((port) => (
								<PortListRow key={port.id} port={port} onPress={() => model.openDetail(port)} />
							))}
						</MaterialListGroup>
					</View>
				))}
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
					title: 'Ports',
					headerSearchBarOptions: {
						placeholder: 'Search ports',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'refresh',
						icon: 'arrow.clockwise',
						label: 'Refresh',
						disabled: snapshot.isLoading,
						onPress: () => void model.load()
					}
				]}
			/>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.refresh().finally(() => setRefreshing(false));
						}}
						colors={[systemColors.blue]}
					/>
				}
			>
				{content}
			</ScrollView>
		</>
	);
}
