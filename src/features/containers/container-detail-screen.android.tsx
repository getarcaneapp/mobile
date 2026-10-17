/** Android rendering of `ContainerDetailView` (ContainerDetailView.swift). */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { CachedAsyncImage } from '@/ui/components/cached-async-image';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { AndroidResourceActionsToolbar } from './android-toolbar';
import { M3Section, SwitchRow, ValueRow } from './android-material';
import {
	configRows,
	healthPresentation,
	hostConfigRows,
	networkRows,
	runtimeRows,
	sortedPorts
} from './container-detail-logic';
import { ContainerProcessesView } from './container-processes-view';
import { ContainerStatsView } from './container-stats-view';
import { EmbeddedContainerLogs } from './logs-view';
import { useContainerDetail, type ContainerDetailModel } from './use-container-detail';

function LinkItem({ title, icon, onPress }: { title: string; icon: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 52,
				paddingHorizontal: 16
			}}
		>
			<Icon name={icon} size={22} color={colors.secondaryLabel} />
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
			<Icon name="chevron.right" size={16} color={colors.secondaryLabel} />
		</Pressable>
	);
}

function StatusHeader({ model }: { model: ContainerDetailModel }) {
	const isDark = useIsDark();
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }}>
			<View>
				<CachedAsyncImage
					url={model.headerIconUrl(isDark)}
					size={56}
					fallback={
						<View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
							<Icon
								name="cube.box.fill"
								size={30}
								color={model.isRunning ? systemColors.green : colors.secondaryLabel}
							/>
						</View>
					}
				/>
				<View
					style={{
						position: 'absolute',
						right: -2,
						bottom: -2,
						width: 14,
						height: 14,
						borderRadius: 7,
						backgroundColor: model.statusIndicatorColor ?? '#8E8E9380'
					}}
				/>
			</View>
			<View style={{ flex: 1, gap: 4 }}>
				<Text style={[m3Type.titleLarge, { color: colors.label, fontWeight: '700' }]}>
					{model.displayedName}
				</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{model.details?.image ? model.details.image : model.container.image}
				</Text>
				<View style={{ flexDirection: 'row', paddingTop: 2 }}>
					<ResourceStatusBadge status={model.statusString} usesCardStyle />
				</View>
			</View>
		</View>
	);
}

function OverviewTab({ model }: { model: ContainerDetailModel }) {
	const [refreshing, setRefreshing] = useState(false);
	const details = model.details;
	const open = (page: 'env' | 'labels' | 'mounts' | 'health') =>
		model.openSubpage(page, model.environmentID, model.container.id);
	return (
		<ScrollView
			style={{ backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingBottom: 32 }}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => {
						setRefreshing(true);
						void model.loadDetails().finally(() => setRefreshing(false));
					}}
				/>
			}
		>
			<M3Section>
				<StatusHeader model={model} />
			</M3Section>
			{details ? (
				<>
					<M3Section title="Overview">
						{model.metadata.map((item) => (
							<ValueRow
								key={item.label}
								title={item.label}
								value={item.value}
								monospaced={item.monospaced}
								valueColor={item.tint}
							/>
						))}
					</M3Section>
					{configRows(details).length > 0 ? (
						<M3Section title="Execution">
							{configRows(details).map((row) =>
								row.kind === 'link' ? (
									<LinkItem
										key={row.title}
										title={row.title}
										icon={row.systemImage}
										onPress={() => open(row.page)}
									/>
								) : (
									<ValueRow
										key={row.title}
										title={row.title}
										value={row.value}
										monospaced={row.kind === 'monospaced'}
									/>
								)
							)}
						</M3Section>
					) : null}
					{model.autoUpdateEnabled !== undefined && model.canAutoUpdate ? (
						<M3Section footer="Excludes this container from automatic updates when off.">
							<SwitchRow
								title="Auto-Update"
								icon="arrow.triangle.2.circlepath.circle"
								value={model.autoUpdateEnabled}
								disabled={model.isSavingAutoUpdate}
								onValueChange={model.setAutoUpdate}
							/>
						</M3Section>
					) : null}
					<M3Section title="Runtime">
						{runtimeRows(details, model.isRunning).map((row) => (
							<ValueRow key={row.title} title={row.title} value={row.value} />
						))}
					</M3Section>
					{!hostConfigRows(details).isEmpty ? (
						<M3Section title="Host Config">
							{hostConfigRows(details).rows.map((row) => (
								<ValueRow key={row.title} title={row.title} value={row.value} />
							))}
							{details.mounts.length > 0 ? (
								<LinkItem
									title={`Mounts (${details.mounts.length})`}
									icon="externaldrive"
									onPress={() => open('mounts')}
								/>
							) : null}
						</M3Section>
					) : null}
					{details.ports.length > 0 ? (
						<M3Section title="Ports" footer="Active port mappings reported by the container.">
							{sortedPorts(details.ports).map((port, index) => (
								<ValueRow
									key={index}
									title={`${port.privatePort}/${port.type}`}
									value={
										port.publicPort !== undefined
											? `${port.ip ? port.ip : '0.0.0.0'}:${port.publicPort}`
											: 'Internal'
									}
									monospaced={port.publicPort !== undefined}
								/>
							))}
						</M3Section>
					) : null}
					{details.state.health ? (
						<M3Section title="Health">
							{(() => {
								const p = healthPresentation(details.state.health.status);
								const tint = p.color === 'secondary' ? undefined : systemColors[p.color];
								return <ValueRow title="Status" value={p.displayStatus} valueColor={tint} />;
							})()}
							<ValueRow title="Failing streak" value={String(details.state.health.failingStreak)} />
							{details.state.health.log && details.state.health.log.length > 0 ? (
								<LinkItem
									title={`History (${details.state.health.log.length})`}
									icon="clock.arrow.circlepath"
									onPress={() => open('health')}
								/>
							) : null}
						</M3Section>
					) : null}
					{networkRows(details).length > 0 ? (
						<M3Section title="Networks">
							{networkRows(details).map((network) => (
								<View
									key={network.name}
									style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 2 }}
								>
									<Text selectable style={[m3Type.titleSmall, { color: colors.label }]}>
										{network.name}
									</Text>
									{network.ip ? (
										<Text
											selectable
											style={{ fontFamily: monoFamily, fontSize: 14, color: colors.secondaryLabel }}
										>{`IP: ${network.ip}`}</Text>
									) : null}
									{network.mac ? (
										<Text
											selectable
											style={{ fontFamily: monoFamily, fontSize: 14, color: colors.secondaryLabel }}
										>{`MAC: ${network.mac}`}</Text>
									) : null}
								</View>
							))}
						</M3Section>
					) : null}
				</>
			) : model.isLoading ? (
				<View style={{ padding: 24, alignItems: 'center' }}>
					<ArcaneLoadingView />
				</View>
			) : null}
		</ScrollView>
	);
}

export function ContainerDetailScreen() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const model = useContainerDetail(envID, id);
	return (
		<>
			<Stack.Screen options={{ title: model.displayedName }} />
			<AndroidResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				runningItemID={model.runningActionID}
				isDisabled={model.isActioning}
				resourceName={model.displayedName}
			/>
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<ScrollableTabBar
					selection={model.selectedTab}
					onSelectionChange={model.setSelectedTab}
					options={model.availableTabs}
					accessibilityLabel="Container detail sections"
				/>
				<View style={{ flex: 1 }}>
					{model.selectedTab === 'overview' ? <OverviewTab model={model} /> : null}
					{model.selectedTab === 'stats' ? (
						<ContainerStatsView
							environmentID={model.environmentID}
							containerID={model.container.id}
						/>
					) : null}
					{model.selectedTab === 'logs' ? (
						<EmbeddedContainerLogs
							environmentID={model.environmentID}
							containerID={model.container.id}
							title={model.displayedName}
							onExpand={model.openLogsFullScreen}
						/>
					) : null}
					{model.selectedTab === 'processes' ? (
						<ContainerProcessesView
							environmentID={model.environmentID}
							containerID={model.container.id}
						/>
					) : null}
				</View>
			</View>
		</>
	);
}
