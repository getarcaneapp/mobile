import {
	BottomSheet,
	Button,
	Circle,
	ContextMenu,
	Divider,
	Grid,
	HStack,
	List,
	NavigationStack,
	Picker,
	RNHostView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	buttonStyle,
	contentShape,
	contentTransition,
	disabled,
	environment,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	monospacedDigit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	opacity,
	padding,
	pickerStyle,
	presentationDetents,
	shapes,
	tag
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import { DockerCounts, environmentIsOnline } from '@/stores/dashboard-stream-logic';
import type { BusiestEntry } from '@/stores/busiest-containers-logic';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { Motion } from '@/theme/tokens';
import { useIsDark, useReduceMotion } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { CachedAsyncImageSwiftUI } from '@/ui/components/cached-async-image-swiftui';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { RowIcon } from '@/ui/components/row-icon';
import {
	CardEntrance,
	cardRowLinkStyle,
	hashKey,
	motionAwareAnimation
} from '@/ui/components/swiftui-motion';
import { GlassCardBackground } from '@/ui/components/swiftui-surfaces';

import {
	containerDisplayName,
	containerIconURL,
	containerIsRunning,
	DashboardTotalsTile,
	displayName,
	percent0,
	ResourceMetricsText,
	type AllEnvironmentsCounts,
	type UsageMetric
} from '../dashboard-logic';
import { relativeNamed, useAllEnvironmentsDashboard } from '../use-all-environments-dashboard';
import { DashboardRowChevron, DashboardSectionTitle, DashboardStatTile } from './dashboard-parts';
import { MetricRing } from './metric-ring';
import { UsageChart } from './usage-chart';

export type AllEnvironmentsDashboardProps = {
	environments: Environment[];
	dockerInfo: Readonly<Record<string, DockerInfo>>;
	counts: AllEnvironmentsCounts;
	volumeCounts: Readonly<Record<string, number>>;
	onOpenEnvironment: (environment: Environment) => void;
	onOpenContainer: (container: ContainerSummary, environmentID: string) => void;
	onOpenTile: (tile: DashboardTotalsTile) => void;
	totalsFootnote: ReactNode;
	hostsAccessory: ReactNode;
};

function Meter({ fraction, fill }: { fraction: number; fill: string | undefined }) {
	return (
		<HStack
			modifiers={[
				frame({ maxWidth: Infinity, minHeight: 4, maxHeight: 4 }),
				accessibilityHidden(true)
			]}
		>
			<RNHostView>
				<View
					style={{
						flex: 1,
						height: 4,
						borderRadius: 2,
						backgroundColor: withOpacity('#8E8E93', 0.15),
						overflow: 'hidden'
					}}
				>
					<View
						style={{
							width: `${fraction * 100}%`,
							height: 4,
							borderRadius: 2,
							backgroundColor: fill ?? 'transparent'
						}}
					/>
				</View>
			</RNHostView>
		</HStack>
	);
}

function HostStatColumn({
	title,
	value,
	meter
}: {
	title: string;
	value: string | undefined;
	meter?: { fraction: number | undefined; tint: string; warnsAbove?: number };
}) {
	const reduceMotion = useReduceMotion();
	const fraction = Math.min(Math.max(meter?.fraction ?? 0, 0), 1);
	const fill =
		meter &&
		meter.warnsAbove !== undefined &&
		meter.fraction !== undefined &&
		meter.fraction >= meter.warnsAbove
			? systemColors.orange
			: meter?.tint;
	return (
		<VStack
			alignment="leading"
			spacing={4}
			modifiers={[lineLimit(1), frame({ maxWidth: Infinity, alignment: 'leading' })]}
		>
			<Text
				modifiers={[
					font({ textStyle: 'caption2' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{title}
			</Text>
			<Text
				modifiers={[
					font({ textStyle: 'subheadline', weight: 'semibold' }),
					monospacedDigit(),
					contentTransition('numericText'),
					...motionAwareAnimation(Motion.state, hashKey(value ?? ''), reduceMotion)
				]}
			>
				{value ?? '—'}
			</Text>
			<VStack modifiers={[opacity(meter ? 1 : 0)]}>
				<Meter fraction={fraction} fill={fill} />
			</VStack>
		</VStack>
	);
}

function BusiestContainerRow({
	entry,
	environmentName
}: {
	entry: BusiestEntry;
	environmentName: string | undefined;
}) {
	const isDark = useIsDark();
	const { container, sample } = entry;
	const running = containerIsRunning(container);
	const metric = (progress: number, tint: string, value: string) => (
		<HStack spacing={6} modifiers={[lineLimit(1), fixedSize()]}>
			<Text
				modifiers={[
					font({ textStyle: 'caption', weight: 'semibold' }),
					monospacedDigit(),
					contentTransition('numericText')
				]}
			>
				{value}
			</Text>
			<HStack modifiers={[frame({ width: 14, height: 14 })]}>
				<RNHostView matchContents>
					<View>
						<MetricRing progress={progress} tint={tint} size={14} lineWidth={2.5} motion="gauge" />
					</View>
				</RNHostView>
			</HStack>
		</HStack>
	);
	return (
		<HStack
			spacing={12}
			modifiers={[
				padding({ vertical: 2 }),
				accessibilityElement('combine'),
				accessibilityLabel(
					[
						containerDisplayName(container),
						running ? 'running' : 'stopped',
						container.image,
						container.status,
						ResourceMetricsText.accessibility(sample),
						environmentName
					]
						.filter(Boolean)
						.join(', ')
				)
			]}
		>
			<ZStack alignment="bottomTrailing" modifiers={[accessibilityHidden(true)]}>
				<CachedAsyncImageSwiftUI
					url={containerIconURL(container, isDark)}
					size={36}
					tiled
					fallback={<RowIcon systemImage="cube.box.fill" tint={systemColors.orange} />}
				/>
				<Circle
					modifiers={[
						foregroundStyle(running ? systemColors.green : withOpacity('#8E8E93', 0.5)),
						frame({ width: 10, height: 10 }),
						padding({ trailing: -2, bottom: -2 })
					]}
				/>
			</ZStack>
			<VStack alignment="leading" spacing={6}>
				<VStack alignment="leading" spacing={2}>
					<Text modifiers={[font({ textStyle: 'body' })]}>{containerDisplayName(container)}</Text>
				</VStack>
				<EnvironmentLabel name={environmentName} />
			</VStack>
			<Spacer minLength={8} />
			<VStack
				alignment="trailing"
				spacing={6}
				modifiers={[frame({ minWidth: 76, alignment: 'trailing' })]}
			>
				{metric(sample.cpuPercent / 100, systemColors.blue, ResourceMetricsText.cpu(sample))}
				{metric(
					ResourceMetricsText.memoryPercent(sample) / 100,
					systemColors.purple,
					ResourceMetricsText.memoryUsed(sample)
				)}
			</VStack>
		</HStack>
	);
}

function DashboardTilesEditorSheet({
	isPresented,
	storedTiles,
	setStoredTiles,
	onDismiss
}: {
	isPresented: boolean;
	storedTiles: string;
	setStoredTiles: (value: string) => void;
	onDismiss: () => void;
}) {
	const accent = useAccentColor();
	const tiles = DashboardTotalsTile.decode(storedTiles);
	const available = DashboardTotalsTile.allCases.filter((t) => !tiles.includes(t));
	const full = tiles.length >= DashboardTotalsTile.maximum;
	const row = (tile: DashboardTotalsTile) => {
		const info = DashboardTotalsTile.info[tile];
		return (
			<HStack spacing={12}>
				<RowIcon systemImage={info.systemImage} tint={systemColors[info.tint]} size={30} />
				<VStack alignment="leading" spacing={2}>
					<Text>{info.title}</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{info.detail}
					</Text>
				</VStack>
				<Spacer minLength={0} />
			</HStack>
		);
	};
	return (
		<BottomSheet isPresented={isPresented} onIsPresentedChange={(value) => !value && onDismiss()}>
			<NavigationStack modifiers={[presentationDetents(['medium', 'large'])]}>
				<Toolbar
					modifiers={[navigationTitle('Dashboard Tiles'), navigationBarTitleDisplayMode('inline')]}
				>
					<List modifiers={[environment('editMode', 'active')]}>
						<Section
							title="Shown"
							footer={<Text>{`Up to ${DashboardTotalsTile.maximum} tiles. Drag to reorder.`}</Text>}
						>
							<List.ForEach
								onMove={(sourceIndices, destination) => {
									const moving = sourceIndices
										.map((i) => tiles[i])
										.filter((t): t is DashboardTotalsTile => t !== undefined);
									const remaining = tiles.filter((_, i) => !sourceIndices.includes(i));
									const insertAt =
										destination - sourceIndices.filter((i) => i < destination).length;
									remaining.splice(insertAt, 0, ...moving);
									setStoredTiles(DashboardTotalsTile.encode(remaining));
								}}
								onDelete={(indices) => {
									const remaining = tiles.filter((_, i) => !indices.includes(i));
									if (remaining.length === 0) return;
									setStoredTiles(DashboardTotalsTile.encode(remaining));
								}}
							>
								{tiles.map((tile) => (
									<HStack key={`shown.${tile}`}>{row(tile)}</HStack>
								))}
							</List.ForEach>
						</Section>
						{available.length > 0 ? (
							<Section title="Available">
								{available.map((tile) => (
									<Button
										key={`available.${tile}`}
										onPress={() => setStoredTiles(DashboardTotalsTile.encode([...tiles, tile]))}
										modifiers={[buttonStyle('plain'), disabled(full), opacity(full ? 0.4 : 1)]}
									>
										<HStack>
											{row(tile)}
											<Image
												systemName="plus.circle.fill"
												modifiers={[
													foregroundStyle(systemColors.green),
													font({ textStyle: 'title3' })
												]}
											/>
										</HStack>
									</Button>
								))}
							</Section>
						) : null}
						<Section>
							<Button
								label="Reset to Defaults"
								systemImage="arrow.counterclockwise"
								onPress={() =>
									setStoredTiles(DashboardTotalsTile.encode(DashboardTotalsTile.defaults))
								}
							/>
						</Section>
					</List>
					<Toolbar.Content>
						<ToolbarItem placement="confirmationAction">
							<Button label="Done" onPress={onDismiss} modifiers={[foregroundStyle(accent)]} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</BottomSheet>
	);
}

export function AllEnvironmentsDashboard(props: AllEnvironmentsDashboardProps) {
	const { environments, dockerInfo, counts, volumeCounts } = props;
	const model = useAllEnvironmentsDashboard(environments, counts);
	const reduceMotion = useReduceMotion();
	const headlineValue = model.headline?.value ?? '—';

	const totalsCard = (
		<ContextMenu>
			<ContextMenu.Trigger>
				<GlassCardBackground>
					<HStack
						alignment="top"
						spacing={8}
						modifiers={[padding({ horizontal: 16, vertical: 14 })]}
					>
						{model.tiles.map((tile) => {
							const info = DashboardTotalsTile.info[tile];
							return (
								<DashboardStatTile
									key={tile}
									title={info.title}
									value={model.tileValue(tile)}
									icon={info.systemImage}
									tint={systemColors[info.tint]}
									onPress={info.opensDestination ? () => props.onOpenTile(tile) : undefined}
								/>
							);
						})}
					</HStack>
				</GlassCardBackground>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				<Button
					label="Edit Tiles"
					systemImage="square.grid.2x2"
					onPress={() => model.setShowsTileEditor(true)}
				/>
			</ContextMenu.Items>
		</ContextMenu>
	);

	const usageCard = (
		<GlassCardBackground>
			<VStack
				alignment="leading"
				spacing={14}
				modifiers={[padding({ all: 16 }), accessibilityElement('contain')]}
			>
				<HStack alignment="firstTextBaseline">
					<VStack alignment="leading" spacing={2}>
						<Text
							modifiers={[
								font({ textStyle: 'title', design: 'rounded', weight: 'semibold' }),
								monospacedDigit(),
								contentTransition('numericText'),
								...motionAwareAnimation(Motion.state, hashKey(headlineValue), reduceMotion)
							]}
						>
							{headlineValue}
						</Text>
						{model.headline ? (
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{model.headline.detail}
							</Text>
						) : null}
					</VStack>
					<Spacer minLength={12} />
					<Picker<UsageMetric>
						label="Metric"
						selection={model.usageMetric}
						onSelectionChange={model.setUsageMetric}
						modifiers={[pickerStyle('segmented'), fixedSize()]}
					>
						<Text modifiers={[tag('CPU')]}>CPU</Text>
						<Text modifiers={[tag('Memory')]}>Memory</Text>
					</Picker>
				</HStack>

				{model.waitingForStats ? (
					<VStack modifiers={[frame({ maxWidth: Infinity, minHeight: 150 })]}>
						<ArcaneLoadingViewSwiftUI label="Waiting for live stats…" variant="inline" />
					</VStack>
				) : (
					<HStack modifiers={[frame({ maxWidth: Infinity, minHeight: 150, maxHeight: 150 })]}>
						<RNHostView>
							<View style={{ flex: 1, height: 150 }}>
								<UsageChart lines={model.usageLines} metric={model.usageMetric} />
							</View>
						</RNHostView>
					</HStack>
				)}

				{model.usageLines.length > 0 ? (
					<Grid horizontalSpacing={10} verticalSpacing={8} alignment="leading">
						{chunk(model.usageLines, 2).map((pair, rowIndex) => (
							<Grid.Row key={rowIndex}>
								{pair.map((line) => (
									<HStack
										key={line.id}
										spacing={6}
										modifiers={[font({ textStyle: 'caption' }), frame({ maxWidth: Infinity })]}
									>
										<Circle
											modifiers={[foregroundStyle(line.color), frame({ width: 8, height: 8 })]}
										/>
										<Text modifiers={[lineLimit(1)]}>{line.name}</Text>
										<Spacer minLength={4} />
										<Text
											modifiers={[
												monospacedDigit(),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
												contentTransition('numericText')
											]}
										>
											{line.current === undefined ? '—' : percent0(line.current)}
										</Text>
									</HStack>
								))}
								{pair.length === 1 ? <Spacer modifiers={[frame({ maxWidth: Infinity })]} /> : null}
							</Grid.Row>
						))}
					</Grid>
				) : null}

				{model.showsStreamCapNote ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{`Live usage covers the first ${model.maxStreams} environments. Change this in App Settings.`}
					</Text>
				) : null}
			</VStack>
		</GlassCardBackground>
	);

	const busiestSection = (
		<VStack alignment="leading" spacing={14}>
			<HStack>
				<VStack alignment="leading" spacing={2}>
					<DashboardSectionTitle title="Busiest Containers" />
					{!model.busiestIsLive &&
					model.busiestUpdatedAt !== undefined &&
					model.busiestEntries.length > 0 ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>{`Updated ${relativeNamed(model.busiestUpdatedAt)}`}</Text>
					) : null}
				</VStack>
				<Spacer />
				<Picker
					label="Sort"
					selection={model.busiestSort}
					onSelectionChange={model.setBusiestSort}
					modifiers={[pickerStyle('segmented'), fixedSize()]}
				>
					<Text modifiers={[tag('cpuUsage')]}>CPU</Text>
					<Text modifiers={[tag('memoryUsage')]}>Memory</Text>
				</Picker>
			</HStack>
			<GlassCardBackground>
				<VStack
					spacing={0}
					modifiers={[
						padding({ vertical: 4 }),
						...motionAwareAnimation(
							Motion.reflow,
							hashKey(model.busiestEntries.map((e) => e.id).join('|')),
							reduceMotion
						)
					]}
				>
					{model.busiestEntries.length === 0 ? (
						<VStack
							modifiers={[
								font({ textStyle: 'subheadline' }),
								frame({ maxWidth: Infinity }),
								padding({ vertical: 20 })
							]}
						>
							{model.busiestIsLive ? (
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									No running containers.
								</Text>
							) : (
								<ArcaneLoadingViewSwiftUI label="Sampling containers…" variant="inline" />
							)}
						</VStack>
					) : (
						model.busiestEntries.map((entry, index) => (
							<VStack key={entry.id} spacing={0}>
								{index > 0 ? <Divider modifiers={[padding({ leading: 64 })]} /> : null}
								<Button
									onPress={() => props.onOpenContainer(entry.container, entry.environmentID)}
									modifiers={[cardRowLinkStyle()]}
								>
									<HStack
										modifiers={[
											padding({ horizontal: 16, vertical: 10 }),
											contentShape(shapes.rectangle())
										]}
									>
										<BusiestContainerRow
											entry={entry}
											environmentName={model.environmentName(entry.environmentID)}
										/>
									</HStack>
								</Button>
							</VStack>
						))
					)}
				</VStack>
			</GlassCardBackground>
		</VStack>
	);

	const hostsSection = (
		<VStack alignment="leading" spacing={14}>
			<HStack>
				<VStack alignment="leading" spacing={2}>
					<DashboardSectionTitle title="Hosts" />
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>{`${model.onlineCount} of ${environments.length} online`}</Text>
				</VStack>
				<Spacer />
				{props.hostsAccessory}
			</HStack>
			<GlassCardBackground>
				<VStack spacing={0} modifiers={[padding({ vertical: 4 })]}>
					{environments.map((environment, index) => {
						const info = dockerInfo[environment.id];
						const isOnline = environmentIsOnline(environment);
						const disk = model.diskPercent(environment.id);
						const volumes = volumeCounts[environment.id];
						const running = info ? DockerCounts.containersRunning(info) : undefined;
						const total = info ? DockerCounts.containers(info) : undefined;
						const images = info ? DockerCounts.images(info) : undefined;
						const label = [
							displayName(environment),
							isOnline ? 'online' : 'offline',
							info ? `${running} of ${total} containers running` : undefined,
							info ? `${images} images` : undefined,
							volumes !== undefined ? `${volumes} volumes` : undefined,
							disk !== undefined ? `disk ${disk.toFixed(0)} percent full` : undefined
						]
							.filter(Boolean)
							.join(', ');
						return (
							<VStack key={environment.id} spacing={0}>
								{index > 0 ? <Divider modifiers={[padding({ leading: 16 })]} /> : null}
								<Button
									onPress={() => props.onOpenEnvironment(environment)}
									modifiers={[cardRowLinkStyle()]}
								>
									<VStack
										alignment="leading"
										spacing={10}
										modifiers={[
											padding({ horizontal: 16, vertical: 12 }),
											contentShape(shapes.rectangle()),
											accessibilityElement('ignore'),
											accessibilityLabel(label),
											accessibilityAddTraits(['isButton'])
										]}
									>
										<HStack spacing={8}>
											<Circle
												modifiers={[
													foregroundStyle(model.colorFor(environment, index)),
													frame({ width: 8, height: 8 })
												]}
											/>
											<Text
												modifiers={[
													font({ textStyle: 'subheadline', weight: 'semibold' }),
													lineLimit(1)
												]}
											>
												{displayName(environment)}
											</Text>
											<Spacer minLength={8} />
											{!isOnline ? (
												<Text
													modifiers={[
														font({ textStyle: 'caption' }),
														foregroundStyle(systemColors.orange)
													]}
												>
													Offline
												</Text>
											) : null}
											<DashboardRowChevron />
										</HStack>
										<HStack alignment="top" spacing={14}>
											<HostStatColumn
												title="Running"
												value={info ? `${running}/${total}` : undefined}
												meter={{
													fraction:
														total !== undefined && total > 0 ? (running ?? 0) / total : undefined,
													tint: systemColors.green
												}}
											/>
											<HostStatColumn
												title="Images"
												value={images !== undefined ? String(images) : undefined}
											/>
											<HostStatColumn
												title="Volumes"
												value={volumes !== undefined ? String(volumes) : undefined}
											/>
											<HostStatColumn
												title="Disk"
												value={disk !== undefined ? percent0(disk) : undefined}
												meter={{
													fraction: disk !== undefined ? disk / 100 : undefined,
													tint: systemColors.teal,
													warnsAbove: 0.9
												}}
											/>
										</HStack>
									</VStack>
								</Button>
							</VStack>
						);
					})}
				</VStack>
			</GlassCardBackground>
		</VStack>
	);

	return (
		<VStack alignment="leading" spacing={36}>
			<CardEntrance id="dashboard.all.totals" index={0}>
				<VStack alignment="leading" spacing={10}>
					{totalsCard}
					{props.totalsFootnote}
				</VStack>
			</CardEntrance>
			<CardEntrance id="dashboard.all.usage" index={1}>
				{usageCard}
			</CardEntrance>
			{model.showsBusiest ? (
				<CardEntrance id="dashboard.all.busiest" index={2}>
					{busiestSection}
				</CardEntrance>
			) : null}
			<CardEntrance id="dashboard.all.hosts" index={3}>
				{hostsSection}
			</CardEntrance>
			<DashboardTilesEditorSheet
				isPresented={model.showsTileEditor}
				storedTiles={model.storedTiles}
				setStoredTiles={model.setStoredTiles}
				onDismiss={() => model.setShowsTileEditor(false)}
			/>
		</VStack>
	);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
	return rows;
}
