/** Android rendering of `SwarmServiceDetailView` (SwarmServiceDetailView.swift). */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, TextButtonRow, ValueRow } from '@/features/containers/android-material';
import { AndroidResourceActionsToolbar } from '@/features/containers/android-toolbar';
import { LabeledRow, LinkItem, MonoText } from '@/features/networks/android-parts';

import { SwarmStateBadge } from './swarm-parts';
import { EmbeddedServiceLogs } from './swarm-logs';
import { SwarmTasksList } from './swarm-tasks-view';
import { useSwarmServiceDetail, type SwarmServiceDetailModel } from './use-swarm-service-detail';

function Overview({ model }: { model: SwarmServiceDetailModel }) {
	const [refreshing, setRefreshing] = useState(false);
	const { draft, inspect } = model;
	return (
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
			<M3Section>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
					<Icon name="shippingbox.fill" size={32} color={m3.primary} />
					<View style={{ flex: 1, gap: 4 }}>
						<Text style={[m3Type.titleLarge, { color: colors.label }]}>{model.name}</Text>
						<Text
							numberOfLines={2}
							ellipsizeMode="middle"
							style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
						>
							{model.image}
						</Text>
						{model.runningText ? (
							<Text
								style={[
									m3Type.labelMedium,
									{
										color: model.summaryHealthy ? systemColors.green : systemColors.orange,
										fontVariant: ['tabular-nums']
									}
								]}
							>
								{model.runningText}
							</Text>
						) : null}
					</View>
				</View>
			</M3Section>
			{model.errorMessage && !inspect ? (
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
						<Icon name="exclamationmark.triangle" size={20} color={systemColors.orange} />
						<Text style={[m3Type.bodyMedium, { color: systemColors.orange, flex: 1 }]}>
							{model.errorMessage}
						</Text>
					</View>
					<TextButtonRow title="Retry" onPress={() => void model.load()} />
				</M3Section>
			) : null}
			<M3Section title="Details">
				<ValueRow title="ID" value={model.serviceID.slice(0, 12)} monospaced />
				{model.modeTitle ? <ValueRow title="Mode" value={model.modeTitle} /> : null}
				{model.stackName ? <ValueRow title="Stack" value={model.stackName} /> : null}
				{model.nodeCount !== undefined ? (
					<ValueRow title="Nodes" value={String(model.nodeCount)} />
				) : null}
				{model.versionIndex !== undefined ? (
					<ValueRow title="Version" value={String(model.versionIndex)} />
				) : null}
				{model.createdText ? <ValueRow title="Created" value={model.createdText} /> : null}
				{model.updatedText ? <ValueRow title="Updated" value={model.updatedText} /> : null}
			</M3Section>
			{model.updateState ? (
				<M3Section title="Last Update">
					<LabeledRow title="State">
						<SwarmStateBadge state={model.updateState} />
					</LabeledRow>
					{model.updateMessage ? (
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, padding: 16 }]}>
							{model.updateMessage}
						</Text>
					) : null}
				</M3Section>
			) : null}
			{draft && model.hasConfigRows ? (
				<M3Section title="Configuration">
					{draft.command !== '' ? (
						<ValueRow title="Command" value={draft.command} monospaced />
					) : null}
					{draft.args !== '' ? <ValueRow title="Args" value={draft.args} monospaced /> : null}
					{draft.workingDir !== '' ? (
						<ValueRow title="Working Dir" value={draft.workingDir} monospaced />
					) : null}
					{draft.user !== '' ? <ValueRow title="User" value={draft.user} /> : null}
					{draft.env.length > 0 ? (
						<LinkItem
							title={`Environment (${draft.env.length})`}
							icon="list.bullet.rectangle"
							onPress={model.openEnv}
						/>
					) : null}
					{draft.labels.length > 0 ? (
						<LinkItem
							title={`Labels (${draft.labels.length})`}
							icon="tag"
							onPress={model.openLabels}
						/>
					) : null}
				</M3Section>
			) : null}
			{draft && (draft.ports.length > 0 || model.virtualIPs.length > 0) ? (
				<M3Section title="Endpoints">
					{draft.ports.map((port) => (
						<View
							key={port.id}
							style={{
								flexDirection: 'row',
								justifyContent: 'space-between',
								minHeight: 48,
								alignItems: 'center',
								paddingHorizontal: 16
							}}
						>
							<MonoText
								value={`${port.target}/${port.proto}`}
								color={colors.label as string}
								size={16}
							/>
							<MonoText
								value={port.published === '' ? 'Not published' : port.published}
								size={16}
							/>
						</View>
					))}
					{model.virtualIPs.map((address) => (
						<ValueRow key={address} title="Virtual IP" value={address} monospaced />
					))}
				</M3Section>
			) : null}
			{model.networkDetails.length > 0 ? (
				<M3Section title="Networks">
					{model.networkDetails.map((network) => (
						<View key={network.id} style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 3 }}>
							<Text style={[m3Type.titleSmall, { color: colors.label }]}>{network.name}</Text>
							<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
								{model.networkDescription(network)}
							</Text>
							{(network.ipamConfigs ?? []).map((config, index) =>
								config.subnet ? <MonoText key={index} value={config.subnet} size={12} /> : null
							)}
						</View>
					))}
				</M3Section>
			) : model.summaryNetworks.length > 0 ? (
				<M3Section title="Networks">
					{model.summaryNetworks.map((network) => (
						<Text key={network} style={[m3Type.bodyLarge, { color: colors.label, padding: 16 }]}>
							{network}
						</Text>
					))}
				</M3Section>
			) : null}
			{model.mounts.length > 0 ? (
				<M3Section title="Storage">
					{model.mounts.map((mount, index) => (
						<View key={index} style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 3 }}>
							<MonoText value={mount.target} color={colors.label as string} size={15} />
							<Text selectable style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
								{model.mountDescription(mount)}
							</Text>
						</View>
					))}
				</M3Section>
			) : null}
		</ScrollView>
	);
}

export function SwarmServiceDetailScreen() {
	const model = useSwarmServiceDetail();
	const { toolbar } = model;
	return (
		<>
			<Stack.Screen options={{ title: model.name }} />
			{model.canManage ? (
				<AndroidResourceActionsToolbar
					primary={toolbar.primary}
					secondary={toolbar.secondary}
					overflow={toolbar.overflow}
					runningItemID={toolbar.runningItemID}
					isDisabled={toolbar.isDisabled}
					resourceName={model.name}
				/>
			) : null}
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<ScrollableTabBar
					selection={model.selectedTab}
					onSelectionChange={model.setSelectedTab}
					options={model.tabs}
					accessibilityLabel="Service detail sections"
				/>
				<View style={{ flex: 1 }}>
					{model.selectedTab === 'overview' ? <Overview model={model} /> : null}
					{model.selectedTab === 'tasks' ? (
						<SwarmTasksList
							environmentID={model.environmentID}
							source={{ kind: 'service', id: model.serviceID }}
						/>
					) : null}
					{model.selectedTab === 'logs' ? (
						<EmbeddedServiceLogs
							environmentID={model.environmentID}
							serviceID={model.serviceID}
							title={model.name}
						/>
					) : null}
				</View>
			</View>
		</>
	);
}
