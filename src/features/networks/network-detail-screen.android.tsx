import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import { NetworkInspect } from '@/sdk/models/network/Network';
import { colors, systemColors } from '@/theme/colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, TextButtonRow, ValueRow } from '@/features/containers/android-material';
import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';
import { LongPressMenu } from '@/features/containers/long-press-menu';

import { LabeledRow, LinkItem, MonoText } from './android-parts';
import {
	containerRowDisplayIP,
	containerRowDisplayName,
	ipamRows,
	networkMetadata,
	sortedPairs,
	titled
} from './network-model';
import { useNetworkDetail } from './use-network-detail';

export function NetworkDetailScreen() {
	const model = useNetworkDetail();
	const { network, inspect } = model;
	const [refreshing, setRefreshing] = useState(false);
	const ipam = ipamRows(inspect?.ipam);
	const peers = inspect ? NetworkInspect.peerList(inspect) : [];
	const services = inspect ? NetworkInspect.serviceList(inspect) : [];
	const labels = inspect ? sortedPairs(inspect.labels) : [];
	const options = inspect ? sortedPairs(inspect.options) : [];

	const toolbar: AndroidToolbarItem[] = [];
	if (model.canConnect)
		toolbar.push({
			kind: 'button',
			id: 'connect',
			icon: 'link.badge.plus',
			label: 'Connect Container',
			onPress: model.openConnect
		});
	if (!model.isBuiltIn)
		toolbar.push({
			kind: 'button',
			id: 'delete',
			icon: 'trash',
			label: 'Delete',
			color: systemColors.red,
			onPress: model.requestDelete
		});

	return (
		<>
			<Stack.Screen options={{ title: model.title }} />
			{toolbar.length > 0 ? <AndroidToolbar items={toolbar} /> : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.loadInspect().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }}>
						<Icon name="network" size={24} color={systemColors.teal} />
						<View style={{ flex: 1 }}>
							<Text style={[m3Type.titleMedium, { color: colors.label }]}>{network.name}</Text>
							<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
								{network.driver}
							</Text>
						</View>
					</View>
				</M3Section>
				<M3Section title="Details">
					{networkMetadata(network).map((item) => (
						<ValueRow key={item.label} title={item.label} value={item.value} />
					))}
					<ValueRow title="ID" value={network.id} monospaced />
					{inspect ? (
						<>
							{inspect.internal ? <ValueRow title="Internal" value="Yes" /> : null}
							<ValueRow title="Attachable" value={inspect.attachable ? 'Yes' : 'No'} />
							<ValueRow title="IPv4" value={inspect.enableIPv4 ? 'Enabled' : 'Disabled'} />
							<ValueRow title="IPv6" value={inspect.enableIPv6 ? 'Enabled' : 'Disabled'} />
						</>
					) : null}
					<LinkItem
						title="Topology"
						icon="point.topleft.down.curvedto.point.bottomright.up"
						onPress={model.openTopology}
					/>
				</M3Section>
				{peers.length > 0 ? (
					<M3Section title={titled('Peers', peers.length)}>
						{peers.map((peer) => (
							<ValueRow key={peer.name} title={peer.name} value={peer.address} monospaced />
						))}
					</M3Section>
				) : null}
				{services.length > 0 ? (
					<M3Section title={titled('Services', services.length)}>
						{services.map((service) => (
							<View key={service.name} style={{ paddingVertical: 6 }}>
								<View style={{ paddingHorizontal: 16 }}>
									<MonoText value={service.name} color={colors.label as string} />
								</View>
								{service.vip ? (
									<LabeledRow title="VIP">
										<MonoText value={service.vip} />
									</LabeledRow>
								) : null}
								{service.ports.length > 0 ? (
									<LabeledRow title="Ports">
										<MonoText value={service.ports.join(', ')} />
									</LabeledRow>
								) : null}
							</View>
						))}
					</M3Section>
				) : null}
				{ipam ? (
					<M3Section title="IPAM">
						{ipam.map((row) => (
							<ValueRow key={row.id} title={row.label} value={row.value} monospaced />
						))}
					</M3Section>
				) : null}
				{model.connectedRows.length > 0 ? (
					<M3Section title={titled('Connected Containers', model.connectedRows.length)}>
						{model.connectedRows.map((row) => (
							<LongPressMenu
								key={row.id}
								title={containerRowDisplayName(row)}
								items={
									model.canDisconnect
										? [
												{
													id: 'disconnect',
													title: 'Disconnect',
													destructive: true,
													onPress: () => model.requestDisconnect(row)
												}
											]
										: []
								}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 16,
									paddingHorizontal: 16,
									paddingVertical: 10
								}}
							>
								<RowIcon systemImage="shippingbox.fill" tint={systemColors.gray} size={30} />
								<View style={{ flex: 1, gap: 4 }}>
									<Text
										numberOfLines={1}
										ellipsizeMode="middle"
										style={[m3Type.titleSmall, { color: colors.label }]}
									>
										{containerRowDisplayName(row)}
									</Text>
									<MonoText value={containerRowDisplayIP(row)} size={12} />
								</View>
							</LongPressMenu>
						))}
					</M3Section>
				) : null}
				{labels.length > 0 ? (
					<M3Section title="Labels">
						{labels.map((pair) => (
							<ValueRow key={pair.key} title={pair.key} value={pair.value} />
						))}
					</M3Section>
				) : null}
				{options.length > 0 ? (
					<M3Section title="Options">
						{options.map((pair) => (
							<ValueRow key={pair.key} title={pair.key} value={pair.value} />
						))}
					</M3Section>
				) : null}
				{model.isLoadingInspect && !inspect ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 24 }}>
						<ActivityIndicator size="small" />
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
							Loading network details…
						</Text>
					</View>
				) : null}
				{model.inspectError && !inspect ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="exclamationmark.triangle" size={20} color={systemColors.orange} />
							<Text style={[m3Type.bodyMedium, { color: systemColors.orange, flex: 1 }]}>
								{model.inspectError}
							</Text>
						</View>
						<TextButtonRow title="Retry" onPress={() => void model.loadInspect()} />
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
