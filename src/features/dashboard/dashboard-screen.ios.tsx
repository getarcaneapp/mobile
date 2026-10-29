import { Host } from '@/ui/host';
import {
	BottomSheet,
	ContentUnavailableView,
	DisclosureGroup,
	Divider,
	Grid,
	HStack,
	LazyVStack,
	RNHostView,
	ScrollView,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	background,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	minimumScaleFactor,
	monospacedDigit,
	onAppear,
	padding,
	presentationDetents,
	presentationDragIndicator,
	refreshable
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentColorStore } from '@/stores/environment-color-store';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { colors, parseHex, systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { EnvironmentContextPicker } from '@/ui/components/environment-context';
import { EnvironmentSwitcherToolbarButton } from '@/ui/components/environment-switcher-button';
import { CardEntrance } from '@/ui/components/swiftui-motion';
import { GlassCardBackground } from '@/ui/components/swiftui-surfaces';

import { AllEnvironmentsDashboard } from './components/all-environments-dashboard';
import { AttentionCenterSheet, AttentionToolbarButton } from './components/attention';
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
import { DashboardPinnedSection } from './components/pinned-section';
import { displayName } from './dashboard-logic';
import { useDashboardModel, type DashboardModel } from './use-dashboard-model';
import { useEnvironmentCounts } from './use-environment-counts';

const environmentColumnCount = Platform.OS === 'ios' && Platform.isPad ? 2 : 1;

function chunk<T>(items: readonly T[], size: number): T[][] {
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
	return rows;
}

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
	const color = (hex && parseHex(hex)) ?? 'secondary';
	const cell = (text: string, label: string) => (
		<Text
			modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityLabel(label)]}
		>
			{text}
		</Text>
	);
	return (
		<VStack alignment="leading" spacing={6}>
			<HStack spacing={4} modifiers={[foregroundStyle(color)]}>
				<Image systemName="server.rack" />
				<Text modifiers={[font({ weight: 'medium' })]}>{displayName(environment)}</Text>
				<Spacer minLength={8} />
			</HStack>
			<HStack
				alignment="top"
				spacing={8}
				modifiers={[
					font({ textStyle: 'subheadline' }),
					monospacedDigit(),
					lineLimit(1),
					minimumScaleFactor(0.6),
					foregroundStyle('primary')
				]}
			>
				{cell(count(updates), `Updates: ${updates === undefined ? 'Unavailable' : updates}`)}
				{cell(
					counts ? `${counts.running} / ${counts.total}` : '—',
					`Containers: ${counts ? `${counts.running} running of ${counts.total}` : 'Unavailable'}`
				)}
				{cell(
					counts ? String(counts.images) : '—',
					`Images: ${counts ? counts.images : 'Unavailable'}`
				)}
				{cell(count(volumes), `Volumes: ${volumes === undefined ? 'Unavailable' : volumes}`)}
			</HStack>
		</VStack>
	);
}

function OverviewSection({
	model,
	expanded,
	setExpanded
}: {
	model: DashboardModel;
	expanded: boolean;
	setExpanded: (v: boolean) => void;
}) {
	const { view } = model;
	const running = model.overviewCounts?.running;
	const total = model.overviewCounts?.total;
	return (
		<VStack alignment="leading" spacing={10}>
			<GlassCardBackground>
				<VStack
					alignment="leading"
					spacing={12}
					modifiers={[padding({ horizontal: 16, vertical: 14 })]}
				>
					<HStack alignment="top" spacing={8}>
						<CardEntrance id="dashboard.tile.updates" index={0}>
							<DashboardStatTile
								title="Updates"
								value={count(model.imageUpdatesTotal)}
								icon="arrow.triangle.2.circlepath"
								tint={systemColors.green}
								onPress={() => model.openTile('updates')}
							/>
						</CardEntrance>
						<CardEntrance id="dashboard.tile.containers" index={1}>
							<DashboardStatTile
								title="Containers"
								value={running !== undefined && total !== undefined ? `${running} / ${total}` : '—'}
								icon="cube.box.fill"
								tint={systemColors.orange}
								onPress={() => model.selectTab('containers')}
							/>
						</CardEntrance>
						<CardEntrance id="dashboard.tile.images" index={2}>
							<DashboardStatTile
								title="Images"
								value={count(model.overviewCounts?.images)}
								icon="square.3.layers.3d.top.filled"
								tint={systemColors.purple}
								onPress={() => model.selectTab('images')}
							/>
						</CardEntrance>
						<CardEntrance id="dashboard.tile.volumes" index={3}>
							<DashboardStatTile
								title="Volumes"
								value={count(view.volumesTotal)}
								icon="externaldrive.fill"
								tint={systemColors.teal}
								onPress={() => model.openTile('volumes')}
							/>
						</CardEntrance>
					</HStack>
					{model.allEnvironmentsPreview ? (
						<DisclosureGroup
							label={expanded ? '' : 'By Environment'}
							isExpanded={expanded}
							onIsExpandedChange={setExpanded}
							modifiers={[
								font({ textStyle: 'subheadline' }),
								accessibilityLabel('Environment breakdown')
							]}
						>
							<VStack alignment="leading" spacing={10}>
								{model.enabledEnvironments.map((environment, index) => (
									<VStack key={environment.id} alignment="leading" spacing={10}>
										{index > 0 ? <Divider /> : null}
										<EnvironmentCountBreakdown model={model} environment={environment} />
									</VStack>
								))}
							</VStack>
						</DisclosureGroup>
					) : null}
				</VStack>
			</GlassCardBackground>
			<CardEntrance id="dashboard.overview.note" index={4}>
				<CountAvailabilityNote
					issues={model.countIssues}
					allEnvironmentsPreview={model.allEnvironmentsPreview}
					enabledEnvironmentCount={model.enabledEnvironments.length}
					isPresented={model.showCountAvailability}
					setPresented={model.setShowCountAvailability}
				/>
			</CardEntrance>
		</VStack>
	);
}

function EnvironmentsSection({ model }: { model: DashboardModel }) {
	const { view } = model;
	const rows = chunk(
		view.environments.map((environment, index) => ({ environment, index })),
		environmentColumnCount
	);
	return (
		<VStack alignment="leading" spacing={14}>
			<HStack>
				<DashboardSectionTitle title="Environments" />
				<Spacer />
				{model.isAdmin ? (
					<UpdateAllButton
						upgrades={model.arcaneUpgradeCount}
						armed={model.isUpdateAllArmed}
						onPress={model.pressUpdateAll}
					/>
				) : null}
			</HStack>
			{model.showsStreamFailedBanner ? <StreamFailedBanner onRetry={model.retryStream} /> : null}
			{model.liveStatsMessage ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{model.liveStatsMessage}
				</Text>
			) : null}
			<Grid horizontalSpacing={12} verticalSpacing={12} alignment="topLeading">
				{rows.map((row) => (
					<Grid.Row key={row.map((r) => r.environment.id).join('|')}>
						{row.map(({ environment, index }) => (
							<CardEntrance
								key={environment.id}
								id={`dashboard.environment.${environment.id}`}
								index={Math.min(index, 5) + 4}
							>
								<EnvironmentRow
									environment={environment}
									dockerInfo={model.dockerInfoByEnvironmentID[environment.id]}
									isActive={
										!model.allEnvironmentsPreview && environment.id === model.activeEnvironmentID
									}
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
							</CardEntrance>
						))}
					</Grid.Row>
				))}
			</Grid>
			{view.environments.length < view.rawEnvironmentCount ? (
				<VStack
					key={`more.${view.environments.length}`}
					modifiers={[
						frame({ maxWidth: Infinity }),
						padding({ vertical: 8 }),
						onAppear(model.showNextEnvironmentBatch)
					]}
				>
					<ArcaneLoadingViewSwiftUI label="Loading more environments…" variant="inline" />
				</VStack>
			) : null}
		</VStack>
	);
}

export function DashboardScreen() {
	const model = useDashboardModel();
	const { view } = model;

	const pinned = model.hasPinnedDashboardResources ? (
		<CardEntrance id="dashboard.pinned" index={4}>
			<DashboardPinnedSection
				refreshToken={view.cardRefreshToken}
				onOpenContainer={(container) => model.openContainer(container, model.activeEnvironmentID)}
				onOpenProject={model.openProject}
			/>
		</CardEntrance>
	) : null;

	return (
		<>
			<Stack.Screen
				options={{ title: 'Dashboard', headerTitle: '', headerLargeTitleEnabled: false }}
			/>
			<AppToolbar placement="left">
				<Stack.Toolbar.View>
					<AttentionToolbarButton
						items={model.attentionItems}
						isPresented={model.showAttentionSummary}
						setPresented={model.setShowAttentionSummary}
						onSelect={model.performAttention}
						onOpenCenter={model.openAttentionCenter}
					/>
				</Stack.Toolbar.View>
			</AppToolbar>
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
			<AppToolbar placement="right">
				{model.supportsActivities ? (
					<Stack.Toolbar.Button
						icon="clock.arrow.circlepath"
						separateBackground
						accessibilityLabel="Activity Center"
						onPress={model.openActivityCenter}
					/>
				) : null}
				{model.canAddEnvironment ? (
					<Stack.Toolbar.Button
						icon="plus"
						separateBackground
						accessibilityLabel="Add Environment"
						onPress={model.openAddEnvironment}
					/>
				) : null}
				{model.canPrune ? (
					<Stack.Toolbar.Button
						icon="trash"
						separateBackground
						tintColor={systemColors.red}
						accessibilityLabel="System Prune"
						onPress={() => model.openPrune()}
					/>
				) : null}
			</AppToolbar>

			<Host style={{ flex: 1 }}>
				<ScrollView
					modifiers={[refreshable(model.refresh), background(colors.systemGroupedBackground)]}
				>
					<LazyVStack
						alignment="leading"
						spacing={36}
						modifiers={[padding({ horizontal: 16, top: 8, bottom: 24 })]}
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
							<ContentUnavailableView
								title="No Environments"
								systemImage="server.rack"
								description="Connect an environment to see live container, image, and system stats here."
								modifiers={[padding({ top: 48 })]}
							/>
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
								<OverviewExpandable model={model} />
								{pinned}
								<EnvironmentsSection model={model} />
							</>
						)}
					</LazyVStack>
				</ScrollView>
				<AttentionCenterSheet
					isPresented={model.showAttentionCenter}
					items={model.attentionItems}
					onSelect={model.performAttention}
					onDismiss={model.attentionCenterDismissed}
				/>
				<BottomSheet
					isPresented={model.showEnvironmentPicker}
					onIsPresentedChange={model.setShowEnvironmentPicker}
				>
					<VStack
						modifiers={[
							presentationDetents(['medium', 'large']),
							presentationDragIndicator('visible'),
							frame({ maxWidth: Infinity, maxHeight: Infinity })
						]}
					>
						<RNHostView>
							<View style={{ flex: 1 }}>
								<EnvironmentContextPicker
									environments={model.pickerEnvironments}
									activeEnvironmentID={model.activeEnvironmentID}
									onSelect={model.selectEnvironment}
									onCancel={() => model.setShowEnvironmentPicker(false)}
								/>
							</View>
						</RNHostView>
					</VStack>
				</BottomSheet>
			</Host>
		</>
	);
}

function OverviewExpandable({ model }: { model: DashboardModel }) {
	const [expanded, setExpanded] = useState(false);
	return <OverviewSection model={model} expanded={expanded} setExpanded={setExpanded} />;
}
