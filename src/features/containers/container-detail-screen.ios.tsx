import { Host } from '@/ui/host';
import {
	List,
	Section,
	Text,
	Toggle,
	VStack,
	HStack,
	ZStack,
	useNativeState
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	disabled,
	font,
	foregroundStyle,
	frame,
	listStyle,
	monospacedDigit,
	offset,
	padding,
	refreshable,
	symbolEffect,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { secondaryHex, useIsDark, useReduceMotion } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { CachedAsyncImageSwiftUI } from '@/ui/components/cached-async-image-swiftui';
import { MonospacedValue } from '@/ui/components/resource-detail';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';
import { withOpacity } from '@/theme/colors';

import { configRows, hostConfigRows, networkRows, runtimeRows } from './container-detail-logic';
import { ContainerProcessesView } from './container-processes-view';
import {
	ContainerHealthSection,
	ContainerPortsSection,
	DetailSection,
	LinkRow,
	ValueRow
} from './container-sections';
import { ContainerStatsView } from './container-stats-view';
import { EmbeddedContainerLogs } from './logs-view';
import { useContainerDetail, type ContainerDetailModel } from './use-container-detail';

function StatusHeader({ model }: { model: ContainerDetailModel }) {
	const isDark = useIsDark();
	const reduceMotion = useReduceMotion();
	const pulsing = useNativeState(model.isRunning && !reduceMotion);
	useEffect(() => {
		pulsing.set(model.isRunning && !reduceMotion);
	}, [pulsing, model.isRunning, reduceMotion]);
	const indicator =
		model.statusIndicatorColor ?? withOpacity(secondaryHex[isDark ? 'dark' : 'light'], 0.3);
	return (
		<HStack spacing={16}>
			<ZStack alignment="bottomTrailing">
				<CachedAsyncImageSwiftUI
					url={model.headerIconUrl(isDark)}
					size={56}
					fallback={
						<Image
							systemName="cube.box.fill"
							modifiers={[
								font({ textStyle: 'title' }),
								foregroundStyle(model.isRunning ? systemColors.green : 'secondary'),
								frame({ width: 56, height: 56 })
							]}
						/>
					}
				/>
				<Image
					systemName="circle.fill"
					modifiers={[
						font({ size: 14 }),
						foregroundStyle(indicator),
						symbolEffect(
							{ effect: 'pulse' },
							{ options: { repeat: 'continuous' }, isActive: pulsing }
						),
						offset({ x: 2, y: 2 })
					]}
				/>
			</ZStack>
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>
					{model.displayedName}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{model.details?.image ? model.details.image : model.container.image}
				</Text>
				<VStack modifiers={[padding({ top: 2 })]}>
					<ResourceStatusBadge status={model.statusString} usesCardStyle />
				</VStack>
			</VStack>
		</HStack>
	);
}

function OverviewTab({ model }: { model: ContainerDetailModel }) {
	const details = model.details;
	const open = (page: 'env' | 'labels' | 'mounts' | 'health') =>
		model.openSubpage(page, model.environmentID, model.container.id);
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.loadDetails)]}>
			<Section>
				<StatusHeader model={model} />
			</Section>
			{details ? (
				<>
					<Section title="Overview">
						{model.metadata.map((item) => (
							<ValueRow key={item.label} label={item.label}>
								<Text
									modifiers={[
										font({ textStyle: 'body', design: item.monospaced ? 'monospaced' : 'default' }),
										foregroundStyle(item.tint ?? 'secondary'),
										textSelection(true)
									]}
								>
									{item.value}
								</Text>
							</ValueRow>
						))}
					</Section>
					{configRows(details).length > 0 ? (
						<DetailSection title="Execution" systemImage="terminal">
							{configRows(details).map((row) =>
								row.kind === 'link' ? (
									<LinkRow
										key={row.title}
										title={row.title}
										systemImage={row.systemImage}
										onPress={() => open(row.page)}
									/>
								) : (
									<ValueRow key={row.title} label={row.title}>
										{row.kind === 'monospaced' ? (
											<MonospacedValue value={row.value} />
										) : (
											<Text modifiers={[font({ textStyle: 'subheadline' }), textSelection(true)]}>
												{row.value}
											</Text>
										)}
									</ValueRow>
								)
							)}
						</DetailSection>
					) : null}
					{model.autoUpdateEnabled !== undefined && model.canAutoUpdate ? (
						<Section footer={<Text>Excludes this container from automatic updates when off.</Text>}>
							<Toggle
								label="Auto-Update"
								systemImage="arrow.triangle.2.circlepath.circle"
								isOn={model.autoUpdateEnabled}
								onIsOnChange={model.setAutoUpdate}
								modifiers={[disabled(model.isSavingAutoUpdate)]}
							/>
						</Section>
					) : null}
					<DetailSection title="Runtime" systemImage="waveform.path.ecg">
						{runtimeRows(details, model.isRunning).map((row) => (
							<ValueRow key={row.title} label={row.title}>
								<Text
									modifiers={[
										font({ textStyle: 'subheadline' }),
										...(row.monospacedDigit ? [monospacedDigit()] : []),
										textSelection(true)
									]}
								>
									{row.value}
								</Text>
							</ValueRow>
						))}
					</DetailSection>
					{!hostConfigRows(details).isEmpty ? (
						<DetailSection title="Host Config" systemImage="server.rack">
							{hostConfigRows(details).rows.map((row) => (
								<ValueRow key={row.title} label={row.title}>
									<Text
										modifiers={[
											font({ textStyle: 'subheadline' }),
											...(row.monospacedDigit ? [monospacedDigit()] : []),
											textSelection(true)
										]}
									>
										{row.value}
									</Text>
								</ValueRow>
							))}
							{details.mounts.length > 0 ? (
								<LinkRow
									title={`Mounts (${details.mounts.length})`}
									systemImage="externaldrive"
									onPress={() => open('mounts')}
								/>
							) : null}
						</DetailSection>
					) : null}
					{details.ports.length > 0 ? <ContainerPortsSection ports={details.ports} /> : null}
					{details.state.health ? (
						<ContainerHealthSection
							health={details.state.health}
							onOpenHistory={() => open('health')}
						/>
					) : null}
					{networkRows(details).length > 0 ? (
						<DetailSection title="Networks" systemImage="network">
							{networkRows(details).map((network) => (
								<VStack
									key={network.name}
									alignment="leading"
									spacing={2}
									modifiers={[
										frame({ maxWidth: Infinity, alignment: 'leading' }),
										textSelection(true)
									]}
								>
									<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
										{network.name}
									</Text>
									{network.ip ? (
										<Text
											modifiers={[
												font({ textStyle: 'callout', design: 'monospaced' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' })
											]}
										>{`IP: ${network.ip}`}</Text>
									) : null}
									{network.mac ? (
										<Text
											modifiers={[
												font({ textStyle: 'callout', design: 'monospaced' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' })
											]}
										>{`MAC: ${network.mac}`}</Text>
									) : null}
								</VStack>
							))}
						</DetailSection>
					) : null}
				</>
			) : model.isLoading ? (
				<ArcaneLoadingViewSwiftUI fillsWidth />
			) : null}
		</List>
	);
}

export function ContainerDetailScreen() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const model = useContainerDetail(envID, id);

	return (
		<>
			<Stack.Screen
				options={{
					title: model.selectedTab === 'stats' ? 'Stats' : model.displayedName,
					headerLargeTitleEnabled: false,
					headerTransparent: false,
					headerShadowVisible: false,
					headerStyle: { backgroundColor: colors.systemGroupedBackground }
				}}
			/>
			<ResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				runningItemID={model.runningActionID}
				isDisabled={model.isActioning}
				resourceName={model.displayedName}
			/>
			<View style={{ flex: 1 }}>
				<ScrollableTabBar
					selection={model.selectedTab}
					onSelectionChange={model.setSelectedTab}
					options={model.availableTabs}
					accessibilityLabel="Container detail sections"
				/>
				<View style={{ flex: 1 }}>
					{model.selectedTab === 'overview' ? (
						<Host style={{ flex: 1 }}>
							<OverviewTab model={model} />
						</Host>
					) : null}
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
