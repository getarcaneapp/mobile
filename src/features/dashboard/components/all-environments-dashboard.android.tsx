import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import type { BusiestEntry } from '@/stores/busiest-containers-logic';
import { DockerCounts, environmentIsOnline } from '@/stores/dashboard-stream-logic';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { CachedAsyncImage } from '@/ui/components/cached-async-image';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { m3 } from '@/ui/components/material-colors';
import { CardEntranceView } from '@/ui/components/motion-views';
import { RowIcon } from '@/ui/components/row-icon';
import { GlassCard } from '@/ui/components/surfaces';
import { m3Type } from '@/ui/components/type-scale';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import {
	containerDisplayName,
	containerIconURL,
	containerIsRunning,
	DashboardTotalsTile,
	displayName,
	percent0,
	ResourceMetricsText,
	type AllEnvironmentsCounts
} from '../dashboard-logic';
import { relativeNamed, useAllEnvironmentsDashboard } from '../use-all-environments-dashboard';
import { DashboardRowChevron, DashboardSectionTitle, DashboardStatTile } from './dashboard-parts';
import { MaterialMenu } from './material-menu';
import { MaterialSheet } from './material-sheet';
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

function Segmented<T extends string>({
	options,
	selection,
	onChange
}: {
	options: { label: string; value: T }[];
	selection: T;
	onChange: (v: T) => void;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				borderWidth: 1,
				borderColor: m3.outline,
				borderRadius: 20,
				overflow: 'hidden',
				height: 36
			}}
		>
			{options.map((option, index) => {
				const selected = option.value === selection;
				return (
					<Pressable
						key={option.value}
						onPress={() => onChange(option.value)}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						android_ripple={{ color: colors.separator as string }}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 4,
							paddingHorizontal: 12,
							borderLeftWidth: index > 0 ? 1 : 0,
							borderLeftColor: m3.outline,
							backgroundColor: selected ? m3.secondaryContainer : 'transparent'
						}}
					>
						{selected ? <Icon name="checkmark" size={14} color={m3.onSecondaryContainer} /> : null}
						<Text
							style={[
								m3Type.labelLarge,
								{ color: selected ? m3.onSecondaryContainer : colors.label }
							]}
						>
							{option.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function Meter({ fraction, fill }: { fraction: number; fill: string | undefined }) {
	return (
		<View
			style={{
				height: 4,
				borderRadius: 2,
				backgroundColor: withOpacity('#8E8E93', 0.15),
				overflow: 'hidden'
			}}
		>
			<View
				style={{
					width: `${Math.min(Math.max(fraction, 0), 1) * 100}%`,
					height: 4,
					borderRadius: 2,
					backgroundColor: fill ?? 'transparent'
				}}
			/>
		</View>
	);
}

function HostStat({
	title,
	value,
	meter
}: {
	title: string;
	value: string | undefined;
	meter?: { fraction: number | undefined; tint: string; warnsAbove?: number };
}) {
	const fill =
		meter &&
		meter.warnsAbove !== undefined &&
		meter.fraction !== undefined &&
		meter.fraction >= meter.warnsAbove
			? systemColors.orange
			: meter?.tint;
	return (
		<View style={{ flex: 1, gap: 4 }}>
			<Text numberOfLines={1} style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
				{title}
			</Text>
			<Text
				numberOfLines={1}
				style={[m3Type.titleSmall, { color: colors.label, fontVariant: ['tabular-nums'] }]}
			>
				{value ?? '—'}
			</Text>
			<View style={{ opacity: meter ? 1 : 0 }}>
				<Meter fraction={meter?.fraction ?? 0} fill={fill} />
			</View>
		</View>
	);
}

function BusiestRow({
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
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
			<Text style={[m3Type.labelMedium, { color: colors.label, fontVariant: ['tabular-nums'] }]}>
				{value}
			</Text>
			<MetricRing progress={progress} tint={tint} size={14} lineWidth={2.5} motion="gauge" />
		</View>
	);
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<View>
				<CachedAsyncImage
					url={containerIconURL(container, isDark)}
					size={36}
					tiled
					fallback={<RowIcon systemImage="cube.box.fill" tint={systemColors.orange} />}
				/>
				<View
					style={{
						position: 'absolute',
						right: -2,
						bottom: -2,
						width: 10,
						height: 10,
						borderRadius: 5,
						backgroundColor: running ? systemColors.green : withOpacity('#8E8E93', 0.5)
					}}
				/>
			</View>
			<View style={{ flex: 1, gap: 6 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>
					{containerDisplayName(container)}
				</Text>
				<EnvironmentLabel name={environmentName} />
			</View>
			<View style={{ alignItems: 'flex-end', gap: 6, minWidth: 76 }}>
				{metric(sample.cpuPercent / 100, systemColors.blue, ResourceMetricsText.cpu(sample))}
				{metric(
					ResourceMetricsText.memoryPercent(sample) / 100,
					systemColors.purple,
					ResourceMetricsText.memoryUsed(sample)
				)}
			</View>
		</View>
	);
}

function TilesEditorSheet({
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
	const tiles = DashboardTotalsTile.decode(storedTiles);
	const available = DashboardTotalsTile.allCases.filter((t) => !tiles.includes(t));
	const full = tiles.length >= DashboardTotalsTile.maximum;
	const save = (next: DashboardTotalsTile[]) => setStoredTiles(DashboardTotalsTile.encode(next));
	const move = (index: number, delta: number) => {
		const next = [...tiles];
		const [tile] = next.splice(index, 1);
		if (tile) next.splice(index + delta, 0, tile);
		save(next);
	};
	const iconButton = (
		icon: string,
		label: string,
		onPress: () => void,
		isDisabled = false,
		tint: string = colors.secondaryLabel as string
	) => (
		<Pressable
			onPress={onPress}
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
			<Icon name={icon} size={20} color={tint} />
		</Pressable>
	);
	const info = (tile: DashboardTotalsTile) => {
		const tileInfo = DashboardTotalsTile.info[tile];
		return (
			<View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
				<RowIcon systemImage={tileInfo.systemImage} tint={systemColors[tileInfo.tint]} size={30} />
				<View style={{ flex: 1, gap: 2 }}>
					<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{tileInfo.title}</Text>
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{tileInfo.detail}
					</Text>
				</View>
			</View>
		);
	};
	return (
		<MaterialSheet isPresented={isPresented} onDismiss={onDismiss} fullHeight>
			<View style={{ paddingBottom: 32 }}>
				<View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 }}>
					<Text style={[m3Type.titleLarge, { flex: 1, color: colors.label }]}>Dashboard Tiles</Text>
					<Pressable onPress={onDismiss} accessibilityRole="button" style={{ padding: 12 }}>
						<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Done</Text>
					</Pressable>
				</View>
				<MaterialSectionHeader title="Shown" />
				<MaterialListGroup>
					{tiles.map((tile, index) => (
						<View
							key={`shown.${tile}`}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								paddingLeft: 16,
								paddingVertical: 4
							}}
						>
							{info(tile)}
							{iconButton('chevron.up', 'Move up', () => move(index, -1), index === 0)}
							{iconButton(
								'chevron.down',
								'Move down',
								() => move(index, 1),
								index === tiles.length - 1
							)}
							{iconButton(
								'minus.circle.fill',
								'Remove',
								() => save(tiles.filter((t) => t !== tile)),
								tiles.length <= 1,
								systemColors.red
							)}
						</View>
					))}
				</MaterialListGroup>
				<Text
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, paddingHorizontal: 24, paddingTop: 6 }
					]}
				>
					{`Up to ${DashboardTotalsTile.maximum} tiles. Use the arrows to reorder.`}
				</Text>
				{available.length > 0 ? (
					<>
						<MaterialSectionHeader title="Available" />
						<MaterialListGroup>
							{available.map((tile) => (
								<Pressable
									key={`available.${tile}`}
									onPress={() => save([...tiles, tile])}
									disabled={full}
									android_ripple={{ color: colors.separator as string }}
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										paddingHorizontal: 16,
										paddingVertical: 10,
										opacity: full ? 0.4 : 1
									}}
								>
									{info(tile)}
									<Icon name="plus.circle.fill" size={24} color={systemColors.green} />
								</Pressable>
							))}
						</MaterialListGroup>
					</>
				) : null}
				<View style={{ height: 16 }} />
				<MaterialListGroup>
					<Pressable
						onPress={() => save(DashboardTotalsTile.defaults)}
						android_ripple={{ color: colors.separator as string }}
						style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
					>
						<Icon name="arrow.counterclockwise" size={20} color={m3.primary} />
						<Text style={[m3Type.bodyLarge, { color: m3.primary }]}>Reset to Defaults</Text>
					</Pressable>
				</MaterialListGroup>
			</View>
		</MaterialSheet>
	);
}

export function AllEnvironmentsDashboard(props: AllEnvironmentsDashboardProps) {
	const { environments, dockerInfo, counts, volumeCounts } = props;
	const model = useAllEnvironmentsDashboard(environments, counts);
	const [totalsMenu, setTotalsMenu] = useState(false);

	return (
		<View style={{ gap: 36 }}>
			<CardEntranceView id="dashboard.all.totals" index={0} style={{ gap: 10 }}>
				<View>
					<Pressable onLongPress={() => setTotalsMenu(true)} accessibilityHint="Hold to edit tiles">
						<GlassCard
							style={{
								flexDirection: 'row',
								alignItems: 'flex-start',
								gap: 8,
								paddingHorizontal: 16,
								paddingVertical: 14
							}}
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
										onLongPress={() => setTotalsMenu(true)}
									/>
								);
							})}
						</GlassCard>
					</Pressable>
					<MaterialMenu
						expanded={totalsMenu}
						onDismiss={() => setTotalsMenu(false)}
						entries={[
							{
								kind: 'item',
								id: 'edit',
								title: 'Edit Tiles',
								onPress: () => model.setShowsTileEditor(true)
							}
						]}
					/>
				</View>
				{props.totalsFootnote}
			</CardEntranceView>

			<CardEntranceView id="dashboard.all.usage" index={1}>
				<GlassCard style={{ padding: 16, gap: 14 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<View style={{ flex: 1, gap: 2 }}>
							<Text
								style={[
									m3Type.headlineSmall,
									{ color: colors.label, fontWeight: '600', fontVariant: ['tabular-nums'] }
								]}
							>
								{model.headline?.value ?? '—'}
							</Text>
							{model.headline ? (
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
									{model.headline.detail}
								</Text>
							) : null}
						</View>
						<Segmented
							options={[
								{ label: 'CPU', value: 'CPU' },
								{ label: 'Memory', value: 'Memory' }
							]}
							selection={model.usageMetric}
							onChange={model.setUsageMetric}
						/>
					</View>
					{model.waitingForStats ? (
						<View style={{ minHeight: 150, alignItems: 'center', justifyContent: 'center' }}>
							<ArcaneLoadingView label="Waiting for live stats…" variant="inline" />
						</View>
					) : (
						<UsageChart lines={model.usageLines} metric={model.usageMetric} />
					)}
					{model.usageLines.length > 0 ? (
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 8 }}>
							{model.usageLines.map((line) => (
								<View
									key={line.id}
									style={{
										flexBasis: '45%',
										flexGrow: 1,
										flexDirection: 'row',
										alignItems: 'center',
										gap: 6
									}}
								>
									<View
										style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: line.color }}
									/>
									<Text
										numberOfLines={1}
										style={[m3Type.bodySmall, { flex: 1, color: colors.label }]}
									>
										{line.name}
									</Text>
									<Text
										style={[
											m3Type.bodySmall,
											{ color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }
										]}
									>
										{line.current === undefined ? '—' : percent0(line.current)}
									</Text>
								</View>
							))}
						</View>
					) : null}
					{model.showsStreamCapNote ? (
						<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
							{`Live usage covers the first ${model.maxStreams} environments. Change this in App Settings.`}
						</Text>
					) : null}
				</GlassCard>
			</CardEntranceView>

			{model.showsBusiest ? (
				<CardEntranceView id="dashboard.all.busiest" index={2} style={{ gap: 14 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<View style={{ flex: 1, gap: 2 }}>
							<DashboardSectionTitle title="Busiest Containers" />
							{!model.busiestIsLive &&
							model.busiestUpdatedAt !== undefined &&
							model.busiestEntries.length > 0 ? (
								<Text
									style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
								>{`Updated ${relativeNamed(model.busiestUpdatedAt)}`}</Text>
							) : null}
						</View>
						<Segmented
							options={[
								{ label: 'CPU', value: 'cpuUsage' as const },
								{ label: 'Memory', value: 'memoryUsage' as const }
							]}
							selection={model.busiestSort}
							onChange={model.setBusiestSort}
						/>
					</View>
					<GlassCard style={{ paddingVertical: 4, overflow: 'hidden' }}>
						{model.busiestEntries.length === 0 ? (
							<View style={{ alignItems: 'center', paddingVertical: 20 }}>
								{model.busiestIsLive ? (
									<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
										No running containers.
									</Text>
								) : (
									<ArcaneLoadingView label="Sampling containers…" variant="inline" />
								)}
							</View>
						) : (
							model.busiestEntries.map((entry, index) => (
								<View key={entry.id}>
									{index > 0 ? (
										<View
											style={{ height: 1, marginLeft: 64, backgroundColor: colors.separator }}
										/>
									) : null}
									<Pressable
										onPress={() => props.onOpenContainer(entry.container, entry.environmentID)}
										android_ripple={{ color: colors.separator as string }}
										accessibilityRole="button"
										accessibilityLabel={`${containerDisplayName(entry.container)}, ${ResourceMetricsText.accessibility(entry.sample)}`}
										style={{ paddingHorizontal: 16, paddingVertical: 10 }}
									>
										<BusiestRow
											entry={entry}
											environmentName={model.environmentName(entry.environmentID)}
										/>
									</Pressable>
								</View>
							))
						)}
					</GlassCard>
				</CardEntranceView>
			) : null}

			<CardEntranceView id="dashboard.all.hosts" index={3} style={{ gap: 14 }}>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<View style={{ flex: 1, gap: 2 }}>
						<DashboardSectionTitle title="Hosts" />
						<Text
							style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
						>{`${model.onlineCount} of ${environments.length} online`}</Text>
					</View>
					{props.hostsAccessory}
				</View>
				<GlassCard style={{ paddingVertical: 4, overflow: 'hidden' }}>
					{environments.map((environment, index) => {
						const info = dockerInfo[environment.id];
						const isOnline = environmentIsOnline(environment);
						const disk = model.diskPercent(environment.id);
						const volumes = volumeCounts[environment.id];
						const running = info ? DockerCounts.containersRunning(info) : undefined;
						const total = info ? DockerCounts.containers(info) : undefined;
						const images = info ? DockerCounts.images(info) : undefined;
						return (
							<View key={environment.id}>
								{index > 0 ? (
									<View style={{ height: 1, marginLeft: 16, backgroundColor: colors.separator }} />
								) : null}
								<Pressable
									onPress={() => props.onOpenEnvironment(environment)}
									android_ripple={{ color: colors.separator as string }}
									accessibilityRole="button"
									accessibilityLabel={[
										displayName(environment),
										isOnline ? 'online' : 'offline',
										info ? `${running} of ${total} containers running` : undefined,
										info ? `${images} images` : undefined,
										volumes !== undefined ? `${volumes} volumes` : undefined,
										disk !== undefined ? `disk ${disk.toFixed(0)} percent full` : undefined
									]
										.filter(Boolean)
										.join(', ')}
									style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
								>
									<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
										<View
											style={{
												width: 8,
												height: 8,
												borderRadius: 4,
												backgroundColor: model.colorFor(environment, index)
											}}
										/>
										<Text
											numberOfLines={1}
											style={[m3Type.titleSmall, { flex: 1, color: colors.label }]}
										>
											{displayName(environment)}
										</Text>
										{!isOnline ? (
											<Text style={[m3Type.bodySmall, { color: systemColors.orange }]}>
												Offline
											</Text>
										) : null}
										<DashboardRowChevron />
									</View>
									<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
										<HostStat
											title="Running"
											value={info ? `${running}/${total}` : undefined}
											meter={{
												fraction:
													total !== undefined && total > 0 ? (running ?? 0) / total : undefined,
												tint: systemColors.green
											}}
										/>
										<HostStat
											title="Images"
											value={images !== undefined ? String(images) : undefined}
										/>
										<HostStat
											title="Volumes"
											value={volumes !== undefined ? String(volumes) : undefined}
										/>
										<HostStat
											title="Disk"
											value={disk !== undefined ? percent0(disk) : undefined}
											meter={{
												fraction: disk !== undefined ? disk / 100 : undefined,
												tint: systemColors.teal,
												warnsAbove: 0.9
											}}
										/>
									</View>
								</Pressable>
							</View>
						);
					})}
				</GlassCard>
			</CardEntranceView>

			<TilesEditorSheet
				isPresented={model.showsTileEditor}
				storedTiles={model.storedTiles}
				setStoredTiles={model.setStoredTiles}
				onDismiss={() => model.setShowsTileEditor(false)}
			/>
		</View>
	);
}
