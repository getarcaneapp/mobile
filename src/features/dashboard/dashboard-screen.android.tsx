import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, type ColorValue } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentColorStore } from '@/stores/environment-color-store';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { colors, parseHex, systemColors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { EnvironmentContextPicker } from '@/ui/components/environment-context';
import { EnvironmentSwitcherToolbarButton } from '@/ui/components/environment-switcher-button';
import { m3 } from '@/ui/components/material-colors';
import { CardEntranceView } from '@/ui/components/motion-views';
import { GlassCard } from '@/ui/components/surfaces';
import { m3Type } from '@/ui/components/type-scale';

import { AllEnvironmentsDashboard } from './components/all-environments-dashboard';
import {
	AttentionCenterSheet,
	AttentionSummarySheet,
	AttentionToolbarButton
} from './components/attention.android';
import {
	CountAvailabilityNote,
	DashboardGreeting,
	DashboardSectionTitle,
	DashboardSkeleton,
	DashboardStatTile,
	StreamFailedBanner,
	UpdateAllButton
} from './components/dashboard-parts';
import { EnvironmentRow } from './components/environment-row';
import { MaterialSheet } from './components/material-sheet';
import { DashboardPinnedSection } from './components/pinned-section';
import { displayName } from './dashboard-logic';
import { useDashboardModel, type DashboardModel } from './use-dashboard-model';
import { useEnvironmentCounts } from './use-environment-counts';

const count = (value: number | undefined) => (value === undefined ? '—' : String(value));

function EnvironmentCountBreakdown({
	model,
	environment
}: {
	model: DashboardModel;
	environment: Environment;
}) {
	const serverURL = useClientManager((s) => s.serverURL);
	const hex = useEnvironmentColorStore((s) => s.hex(serverURL, environment.id));
	const updates = useImageUpdateCountStore((s) =>
		s.count(environment.id, model.client, model.currentUser?.id)
	);
	const counts = useEnvironmentCounts(
		environment.id,
		model.dockerInfoByEnvironmentID[environment.id]
	);
	const volumes = model.view.volumeCounts[environment.id];
	const color = (hex && parseHex(hex)) ?? colors.secondaryLabel;
	const cell = (text: string, label: string) => (
		<Text
			accessibilityLabel={label}
			numberOfLines={1}
			style={[m3Type.bodyMedium, { flex: 1, color: colors.label, fontVariant: ['tabular-nums'] }]}
		>
			{text}
		</Text>
	);
	return (
		<View style={{ gap: 6 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
				<Icon name="server.rack" size={14} color={color} />
				<Text style={[m3Type.titleSmall, { color }]}>{displayName(environment)}</Text>
			</View>
			<View style={{ flexDirection: 'row', gap: 8 }}>
				{cell(count(updates), `Updates: ${updates ?? 'Unavailable'}`)}
				{cell(
					counts ? `${counts.running} / ${counts.total}` : '—',
					`Containers: ${counts ? `${counts.running} running of ${counts.total}` : 'Unavailable'}`
				)}
				{cell(
					counts ? String(counts.images) : '—',
					`Images: ${counts ? counts.images : 'Unavailable'}`
				)}
				{cell(count(volumes), `Volumes: ${volumes ?? 'Unavailable'}`)}
			</View>
		</View>
	);
}

function OverviewSection({ model }: { model: DashboardModel }) {
	const { view } = model;
	const [expanded, setExpanded] = useState(false);
	const running = model.overviewCounts?.running;
	const total = model.overviewCounts?.total;
	return (
		<View style={{ gap: 10 }}>
			<GlassCard style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
				<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
					<DashboardStatTile
						title="Updates"
						value={count(model.imageUpdatesTotal)}
						icon="arrow.triangle.2.circlepath"
						tint={systemColors.green}
						onPress={() => model.openTile('updates')}
					/>
					<DashboardStatTile
						title="Containers"
						value={running !== undefined && total !== undefined ? `${running} / ${total}` : '—'}
						icon="cube.box.fill"
						tint={systemColors.orange}
						onPress={() => model.selectTab('containers')}
					/>
					<DashboardStatTile
						title="Images"
						value={count(model.overviewCounts?.images)}
						icon="square.3.layers.3d.top.filled"
						tint={systemColors.purple}
						onPress={() => model.selectTab('images')}
					/>
					<DashboardStatTile
						title="Volumes"
						value={count(view.volumesTotal)}
						icon="externaldrive.fill"
						tint={systemColors.teal}
						onPress={() => model.openTile('volumes')}
					/>
				</View>
				{model.allEnvironmentsPreview ? (
					<View style={{ gap: 10 }}>
						<Pressable
							onPress={() => setExpanded(!expanded)}
							accessibilityRole="button"
							accessibilityLabel="Environment breakdown"
							accessibilityState={{ expanded }}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'space-between',
								paddingVertical: 4
							}}
						>
							<Text style={[m3Type.bodyMedium, { color: m3.primary }]}>
								{expanded ? '' : 'By Environment'}
							</Text>
							<Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={18} color={m3.primary} />
						</Pressable>
						{expanded
							? model.enabledEnvironments.map((environment, index) => (
									<View key={environment.id} style={{ gap: 10 }}>
										{index > 0 ? (
											<View style={{ height: 1, backgroundColor: colors.separator }} />
										) : null}
										<EnvironmentCountBreakdown model={model} environment={environment} />
									</View>
								))
							: null}
					</View>
				) : null}
			</GlassCard>
			<CountAvailabilityNote
				issues={model.countIssues}
				allEnvironmentsPreview={model.allEnvironmentsPreview}
				enabledEnvironmentCount={model.enabledEnvironments.length}
				isPresented={model.showCountAvailability}
				setPresented={model.setShowCountAvailability}
			/>
		</View>
	);
}

function EnvironmentsSection({ model }: { model: DashboardModel }) {
	const { view } = model;
	return (
		<View style={{ gap: 14 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<View style={{ flex: 1 }}>
					<DashboardSectionTitle title="Environments" />
				</View>
				{model.isAdmin ? (
					<UpdateAllButton
						upgrades={model.arcaneUpgradeCount}
						armed={model.isUpdateAllArmed}
						onPress={model.pressUpdateAll}
					/>
				) : null}
			</View>
			{model.showsStreamFailedBanner ? <StreamFailedBanner onRetry={model.retryStream} /> : null}
			{model.liveStatsMessage ? (
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{model.liveStatsMessage}
				</Text>
			) : null}
			{view.environments.map((environment, index) => (
				<CardEntranceView
					key={environment.id}
					id={`dashboard.environment.${environment.id}`}
					index={Math.min(index, 5) + 4}
				>
					<EnvironmentRow
						environment={environment}
						dockerInfo={model.dockerInfoByEnvironmentID[environment.id]}
						isActive={!model.allEnvironmentsPreview && environment.id === model.activeEnvironmentID}
						allEnvironmentsPreview={model.allEnvironmentsPreview}
						onOpen={() => model.openEnvironment(environment)}
						onRefresh={() => model.refreshEnvironmentDockerInfo(environment.id)}
						onUseEnvironment={() =>
							useClientManager
								.getState()
								.setActiveEnvironment(environment.id, environment.name ?? environment.id)
						}
						onColor={() => model.openEnvironmentColor(environment)}
						onUpgrade={() => model.openSystemUpgrade(environment.id)}
						onPrune={() => model.openPrune(environment.id)}
					/>
				</CardEntranceView>
			))}
			{view.environments.length < view.rawEnvironmentCount ? (
				<View
					key={`more.${view.environments.length}`}
					onLayout={model.showNextEnvironmentBatch}
					style={{ alignItems: 'center', paddingVertical: 8 }}
				>
					<ArcaneLoadingView label="Loading more environments…" variant="inline" />
				</View>
			) : null}
		</View>
	);
}

function ToolbarIconButton({
	icon,
	label,
	color,
	onPress
}: {
	icon: string;
	label: string;
	color: ColorValue;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
			style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
		>
			<Icon name={icon} size={24} color={color} />
		</Pressable>
	);
}

export function DashboardScreen() {
	const model = useDashboardModel();
	const { view } = model;
	const [refreshing, setRefreshing] = useState(false);

	const pinned = model.hasPinnedDashboardResources ? (
		<CardEntranceView id="dashboard.pinned" index={4}>
			<DashboardPinnedSection
				refreshToken={view.cardRefreshToken}
				onOpenContainer={(container) => model.openContainer(container, model.activeEnvironmentID)}
				onOpenProject={model.openProject}
			/>
		</CardEntranceView>
	) : null;

	return (
		<>
			<Stack.Screen options={{ title: 'Dashboard', headerTitle: '' }} />
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.View>
					<AttentionToolbarButton
						items={model.attentionItems}
						isPresented={model.showAttentionSummary}
						setPresented={model.setShowAttentionSummary}
						onSelect={model.performAttention}
						onOpenCenter={model.openAttentionCenter}
					/>
				</Stack.Toolbar.View>
			</Stack.Toolbar>
			{!model.allEnvironmentsPreview ? (
				<EnvironmentSwitcherToolbarButton
					placement="left"
					environments={model.pickerEnvironments}
					activeEnvironmentID={model.activeEnvironmentID}
					activeEnvironmentName={model.activeEnvironmentName}
					allEnvironmentsPreview={model.allEnvironmentsPreview}
					onPress={() => model.setShowEnvironmentPicker(true)}
				/>
			) : null}
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.View>
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						{model.supportsActivities ? (
							<ToolbarIconButton
								icon="clock.arrow.circlepath"
								label="Activity Center"
								color={m3.onSurfaceVariant}
								onPress={model.openActivityCenter}
							/>
						) : null}
						{model.canAddEnvironment ? (
							<ToolbarIconButton
								icon="plus"
								label="Add Environment"
								color={m3.onSurfaceVariant}
								onPress={model.openAddEnvironment}
							/>
						) : null}
						{model.canPrune ? (
							<ToolbarIconButton
								icon="trash"
								label="System Prune"
								color={systemColors.red}
								onPress={() => model.openPrune()}
							/>
						) : null}
					</View>
				</Stack.Toolbar.View>
			</Stack.Toolbar>

			<ScrollView
				style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 36 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						colors={[m3.primary as string]}
						onRefresh={async () => {
							setRefreshing(true);
							await withCleanup(
								() => model.refresh(),
								() => setRefreshing(false)
							);
						}}
					/>
				}
			>
				<DashboardGreeting
					userName={
						model.currentUser
							? model.currentUser.displayName || model.currentUser.username
							: undefined
					}
				/>
				{model.showsSkeleton ? (
					<DashboardSkeleton />
				) : model.showsEmptyState ? (
					<View style={{ alignItems: 'center', gap: 8, paddingTop: 48 }}>
						<Icon name="server.rack" size={44} color={colors.secondaryLabel} />
						<Text style={[m3Type.titleLarge, { color: colors.label }]}>No Environments</Text>
						<Text
							style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}
						>
							Connect an environment to see live container, image, and system stats here.
						</Text>
					</View>
				) : model.refreshedDashboardPreview ? (
					<>
						{model.showsStreamFailedBanner ? (
							<StreamFailedBanner onRetry={model.retryStream} />
						) : null}
						<AllEnvironmentsDashboard
							environments={model.enabledEnvironments}
							dockerInfo={model.dockerInfoByEnvironmentID}
							counts={{
								running: model.overviewCounts?.running,
								total: model.overviewCounts?.total,
								images: model.overviewCounts?.images,
								volumes: view.volumesTotal,
								updates: model.imageUpdatesTotal,
								vulnerabilities: model.attention.vulnerabilities
							}}
							volumeCounts={view.volumeCounts}
							onOpenEnvironment={model.openEnvironment}
							onOpenContainer={model.openContainer}
							onOpenTile={model.openTile}
							totalsFootnote={
								<CountAvailabilityNote
									issues={model.countIssues}
									allEnvironmentsPreview={model.allEnvironmentsPreview}
									enabledEnvironmentCount={model.enabledEnvironments.length}
									isPresented={model.showCountAvailability}
									setPresented={model.setShowCountAvailability}
								/>
							}
							hostsAccessory={
								model.isAdmin ? (
									<UpdateAllButton
										upgrades={model.arcaneUpgradeCount}
										armed={model.isUpdateAllArmed}
										onPress={model.pressUpdateAll}
									/>
								) : null
							}
						/>
						{pinned}
					</>
				) : (
					<>
						<CardEntranceView id="dashboard.overview" index={0}>
							<OverviewSection model={model} />
						</CardEntranceView>
						{pinned}
						<EnvironmentsSection model={model} />
					</>
				)}
			</ScrollView>

			<AttentionSummarySheet
				items={model.attentionItems}
				isPresented={model.showAttentionSummary}
				setPresented={model.setShowAttentionSummary}
				onSelect={model.performAttention}
			/>
			<AttentionCenterSheet
				isPresented={model.showAttentionCenter}
				items={model.attentionItems}
				onSelect={model.performAttention}
				onDismiss={model.attentionCenterDismissed}
			/>
			<MaterialSheet
				isPresented={model.showEnvironmentPicker}
				onDismiss={() => model.setShowEnvironmentPicker(false)}
				fullHeight
			>
				<View style={{ height: 520 }}>
					<EnvironmentContextPicker
						environments={model.pickerEnvironments}
						activeEnvironmentID={model.activeEnvironmentID}
						onSelect={model.selectEnvironment}
						onCancel={() => model.setShowEnvironmentPicker(false)}
					/>
				</View>
			</MaterialSheet>
		</>
	);
}
