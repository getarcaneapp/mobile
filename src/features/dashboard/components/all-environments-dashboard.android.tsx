import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { pluralCount } from '@/core/plural';
import { activityStatusTint } from '@/features/activities/activity-display';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import type { BusiestEntry } from '@/stores/busiest-containers-logic';
import { environmentIsOnline } from '@/stores/dashboard-stream-logic';
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

import {
	byteString,
	containerDisplayName,
	containerIconURL,
	containerIsRunning,
	displayName,
	percent0,
	ResourceMetricsText
} from '../dashboard-logic';
import {
	activityEnvironmentID,
	activityTime,
	activityTitle,
	filterActivityGroups,
	jobLabel,
	overviewListLimit,
	sortOverviewAttention,
	type ActivityFilter,
	type OverviewAttentionAction,
	type OverviewAttentionSeverity,
	type OverviewAttentionSort
} from '../dashboard-overview-logic';
import { DashboardWidget, type DashboardWidgetID } from '../dashboard-widgets';
import {
	relativeNamed,
	useAllEnvironmentsDashboard,
	useBusiestCard,
	useHealthyStat,
	useHostDiskPercent,
	useOverviewAttention,
	useReclaimable,
	useRecentActivity,
	useRiskStat,
	useTopMemory,
	useUpcomingJobs,
	useUsageCard,
	type AllEnvironmentsDashboardModel
} from '../use-all-environments-dashboard';
import { useEnvironmentCounts } from '../use-environment-counts';
import type { AllEnvironmentsDashboardProps } from './all-environments-dashboard.types';
import { DashboardRowChevron, DashboardSectionTitle } from './dashboard-parts';
import { MetricRing } from './metric-ring';
import { UsageChart } from './usage-chart';

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

function UsageCard({ model }: { model: AllEnvironmentsDashboardModel }) {
	const usage = useUsageCard(model);
	return (
		<GlassCard style={{ padding: 16, gap: 14 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<View style={{ flex: 1, gap: 2 }}>
					<Text
						style={[
							m3Type.headlineSmall,
							{ color: colors.label, fontWeight: '600', fontVariant: ['tabular-nums'] }
						]}
					>
						{usage.headline?.value ?? '—'}
					</Text>
					{usage.headline ? (
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
							{usage.headline.detail}
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
			{usage.waitingForStats ? (
				<View style={{ minHeight: 150, alignItems: 'center', justifyContent: 'center' }}>
					<ArcaneLoadingView label="Waiting for live stats…" variant="inline" />
				</View>
			) : (
				<UsageChart lines={usage.usageLines} metric={model.usageMetric} />
			)}
			{usage.usageLines.length > 0 ? (
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 8 }}>
					{usage.usageLines.map((line) => (
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
							<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: line.color }} />
							<Text numberOfLines={1} style={[m3Type.bodySmall, { flex: 1, color: colors.label }]}>
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
	);
}

function BusiestSection({
	model,
	onOpenContainer
}: {
	model: AllEnvironmentsDashboardModel;
	onOpenContainer: (container: ContainerSummary, environmentID: string) => void;
}) {
	const busiest = useBusiestCard(model);
	return (
		<View style={{ gap: 14 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<View style={{ flex: 1, gap: 2 }}>
					<DashboardSectionTitle title="Busiest Containers" />
					{!busiest.isLive && busiest.updatedAt !== undefined && busiest.entries.length > 0 ? (
						<Text
							style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
						>{`Updated ${relativeNamed(busiest.updatedAt)}`}</Text>
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
				{busiest.entries.length === 0 ? (
					<View style={{ alignItems: 'center', paddingVertical: 20 }}>
						{busiest.isLive ? (
							<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
								No running containers.
							</Text>
						) : (
							<ArcaneLoadingView label="Sampling containers…" variant="inline" />
						)}
					</View>
				) : (
					busiest.entries.map((entry, index) => (
						<View key={entry.id}>
							{index > 0 ? (
								<View style={{ height: 1, marginLeft: 64, backgroundColor: colors.separator }} />
							) : null}
							<Pressable
								onPress={() => onOpenContainer(entry.container, entry.environmentID)}
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
		</View>
	);
}

function HostRow({
	model,
	environment,
	index,
	info,
	volumes,
	onOpenEnvironment
}: {
	model: AllEnvironmentsDashboardModel;
	environment: Environment;
	index: number;
	info: DockerInfo | undefined;
	volumes: number | undefined;
	onOpenEnvironment: (environment: Environment) => void;
}) {
	const isOnline = environmentIsOnline(environment);
	const disk = useHostDiskPercent(environment.id);
	const counts = useEnvironmentCounts(environment.id, info);
	const running = counts?.running;
	const total = counts?.total;
	const images = counts?.images;
	return (
		<View>
			{index > 0 ? (
				<View style={{ height: 1, marginLeft: 16, backgroundColor: colors.separator }} />
			) : null}
			<Pressable
				onPress={() => onOpenEnvironment(environment)}
				android_ripple={{ color: colors.separator as string }}
				accessibilityRole="button"
				accessibilityLabel={[
					displayName(environment),
					isOnline ? 'online' : 'offline',
					info ? `${running} of ${total} containers running` : undefined,
					images !== undefined ? pluralCount(images, 'image') : undefined,
					volumes !== undefined ? pluralCount(volumes, 'volume') : undefined,
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
					<Text numberOfLines={1} style={[m3Type.titleSmall, { flex: 1, color: colors.label }]}>
						{displayName(environment)}
					</Text>
					{!isOnline ? (
						<Text style={[m3Type.bodySmall, { color: systemColors.orange }]}>Offline</Text>
					) : null}
					<DashboardRowChevron />
				</View>
				<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
					<HostStat
						title="Running"
						value={info ? `${running}/${total}` : undefined}
						meter={{
							fraction: total !== undefined && total > 0 ? (running ?? 0) / total : undefined,
							tint: systemColors.green
						}}
					/>
					<HostStat title="Images" value={images !== undefined ? String(images) : undefined} />
					<HostStat title="Volumes" value={volumes !== undefined ? String(volumes) : undefined} />
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
}

function WidgetHeader({ title, children }: { title: string; children?: ReactNode }) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			<View style={{ flex: 1 }}>
				<DashboardSectionTitle title={title} />
			</View>
			{children}
		</View>
	);
}

function WidgetMessage({ text }: { text: string }) {
	return (
		<Text
			style={[
				m3Type.bodyMedium,
				{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingVertical: 14 }
			]}
		>
			{text}
		</Text>
	);
}

function WidgetLoading() {
	return (
		<View style={{ alignItems: 'center', paddingVertical: 20 }}>
			<ArcaneLoadingView variant="inline" />
		</View>
	);
}

function WidgetRows<T>({
	items,
	keyFor,
	labelFor,
	onPress,
	children
}: {
	items: readonly T[];
	keyFor: (item: T) => string;
	labelFor: (item: T) => string;
	onPress?: (item: T) => void;
	children: (item: T) => ReactNode;
}) {
	return (
		<View style={{ paddingVertical: 4 }}>
			{items.map((item, index) => (
				<View key={keyFor(item)}>
					{index > 0 ? (
						<View style={{ height: 1, marginLeft: 16, backgroundColor: colors.separator }} />
					) : null}
					<Pressable
						onPress={onPress ? () => onPress(item) : undefined}
						disabled={!onPress}
						android_ripple={onPress ? { color: colors.separator as string } : undefined}
						accessibilityRole={onPress ? 'button' : undefined}
						accessibilityLabel={labelFor(item)}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 12,
							paddingHorizontal: 16,
							paddingVertical: 10
						}}
					>
						{children(item)}
					</Pressable>
				</View>
			))}
		</View>
	);
}

function Dot({ color }: { color: string }) {
	return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

function TrailingCaption({ text }: { text: string }) {
	return (
		<Text
			numberOfLines={1}
			style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }]}
		>
			{text}
		</Text>
	);
}

function CountBadge({ count }: { count: number | undefined }) {
	if (!count || count < 2) return null;
	return (
		<View
			style={{
				paddingHorizontal: 6,
				paddingVertical: 2,
				borderRadius: 8,
				backgroundColor: m3.surfaceContainerHighest
			}}
		>
			<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>{`×${count}`}</Text>
		</View>
	);
}

function RowText({
	title,
	environmentID,
	model,
	detail,
	badge
}: {
	title: string;
	environmentID: string;
	model: AllEnvironmentsDashboardModel;
	detail?: string;
	badge?: number;
}) {
	return (
		<View style={{ flex: 1, gap: 3 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
				<Text numberOfLines={1} style={[m3Type.titleSmall, { flexShrink: 1, color: colors.label }]}>
					{title}
				</Text>
				<CountBadge count={badge} />
			</View>
			<EnvironmentLabel
				name={model.environmentName(environmentID)}
				color={model.environmentColor(environmentID)}
			/>
			{detail ? (
				<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{detail}
				</Text>
			) : null}
		</View>
	);
}

function StatCard({
	id,
	value,
	detail,
	loading = false,
	onPress
}: {
	id: DashboardWidgetID;
	value: string | undefined;
	detail: string;
	loading?: boolean;
	onPress?: () => void;
}) {
	const info = DashboardWidget.info[id];
	const shown = loading ? '—' : (value ?? '—');
	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			android_ripple={onPress ? { color: colors.separator as string } : undefined}
			accessibilityRole={onPress ? 'button' : undefined}
			accessibilityLabel={`${info.title}: ${shown}, ${detail}`}
			style={{ flex: 1 }}
		>
			<GlassCard style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 6 }}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
					<Icon name={info.systemImage} size={14} color={systemColors[info.tint]} />
					<Text numberOfLines={1} style={[m3Type.labelMedium, { color: colors.secondaryLabel }]}>
						{info.title}
					</Text>
				</View>
				<Text
					numberOfLines={1}
					adjustsFontSizeToFit
					style={[
						m3Type.headlineSmall,
						{ color: colors.label, fontWeight: '600', fontVariant: ['tabular-nums'] }
					]}
				>
					{shown}
				</Text>
				<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{detail}
				</Text>
			</GlassCard>
		</Pressable>
	);
}

function HealthyStat({ model }: { model: AllEnvironmentsDashboardModel }) {
	const stat = useHealthyStat(model);
	return <StatCard id="healthy" value={stat.value} detail={stat.detail} />;
}

function AttentionCountStat({ model }: { model: AllEnvironmentsDashboardModel }) {
	const attention = useOverviewAttention(model);
	return (
		<StatCard
			id="attentionCount"
			value={String(attention.items.length)}
			detail={`${attention.critical} critical`}
			loading={attention.loading}
		/>
	);
}

function UpdatesStat({
	model,
	onPress
}: {
	model: AllEnvironmentsDashboardModel;
	onPress: () => void;
}) {
	const pending = model.counts.updates;
	return (
		<StatCard
			id="updates"
			value={pending === undefined ? undefined : String(pending)}
			detail={
				pending === undefined ? 'Checking…' : pending === 0 ? 'Up to date' : 'Updates available'
			}
			onPress={onPress}
		/>
	);
}

function RiskStat({ onPress }: { onPress: () => void }) {
	const risk = useRiskStat();
	const delta =
		risk.delta !== undefined && risk.delta !== 0
			? `${risk.delta > 0 ? '↑' : '↓'}${Math.abs(risk.delta)} · `
			: '';
	return (
		<StatCard
			id="risk"
			value={risk.score === undefined ? undefined : String(risk.score)}
			detail={
				risk.failed
					? 'Unavailable'
					: risk.score === undefined
						? 'No scan'
						: `${delta}${risk.knownExploited} known exploited`
			}
			loading={risk.loading}
			onPress={onPress}
		/>
	);
}

function ReclaimableStat() {
	const reclaimable = useReclaimable();
	return (
		<StatCard
			id="reclaimableTotal"
			value={reclaimable.failed ? undefined : byteString(reclaimable.total)}
			detail={
				reclaimable.environmentCount > 1
					? `Across ${reclaimable.environmentCount} environments`
					: 'Unused data'
			}
			loading={reclaimable.loading}
		/>
	);
}

function StatWidget({
	id,
	model,
	props
}: {
	id: DashboardWidgetID;
	model: AllEnvironmentsDashboardModel;
	props: AllEnvironmentsDashboardProps;
}) {
	switch (id) {
		case 'healthy':
			return <HealthyStat model={model} />;
		case 'attentionCount':
			return <AttentionCountStat model={model} />;
		case 'updates':
			return <UpdatesStat model={model} onPress={props.onOpenUpdates} />;
		case 'risk':
			return <RiskStat onPress={props.onOpenSecurity} />;
		case 'reclaimableTotal':
			return <ReclaimableStat />;
		default:
			return null;
	}
}

const severityColor = (severity: OverviewAttentionSeverity) =>
	severity === 'critical'
		? systemColors.red
		: severity === 'warning'
			? systemColors.orange
			: systemColors.blue;

function AttentionWidget({
	model,
	onAction
}: {
	model: AllEnvironmentsDashboardModel;
	onAction: (action: OverviewAttentionAction) => void;
}) {
	const attention = useOverviewAttention(model);
	const [sort, setSort] = useState<OverviewAttentionSort>('impact');
	const items = sortOverviewAttention(attention.items, sort).slice(0, overviewListLimit);
	return (
		<View style={{ gap: 14 }}>
			<WidgetHeader title="Needs Attention">
				<Segmented
					options={[
						{ label: 'Impact', value: 'impact' as const },
						{ label: 'Newest', value: 'newest' as const }
					]}
					selection={sort}
					onChange={setSort}
				/>
			</WidgetHeader>
			<GlassCard style={{ overflow: 'hidden' }}>
				{attention.loading ? (
					<WidgetLoading />
				) : items.length === 0 ? (
					<WidgetMessage text={attention.failed ? 'Unavailable' : 'No issues'} />
				) : (
					<WidgetRows
						items={items}
						keyFor={(item) => item.key}
						labelFor={(item) => `${item.title}, ${item.detail}, ${item.actionLabel}`}
						onPress={(item) => onAction(item.action)}
					>
						{(item) => (
							<>
								<Dot color={severityColor(item.severity)} />
								<RowText
									title={item.title}
									environmentID={item.environmentID}
									model={model}
									detail={item.detail}
									badge={item.count}
								/>
								<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{item.actionLabel}</Text>
							</>
						)}
					</WidgetRows>
				)}
			</GlassCard>
		</View>
	);
}

function ActivityWidget({
	model,
	onOpenActivity
}: {
	model: AllEnvironmentsDashboardModel;
	onOpenActivity: (status?: 'failed') => void;
}) {
	const recent = useRecentActivity();
	const [filter, setFilter] = useState<ActivityFilter>('all');
	const groups = filterActivityGroups(recent.groups, filter);
	return (
		<View style={{ gap: 14 }}>
			<DashboardSectionTitle title="Recent Activity" />
			<Segmented
				options={[
					{ label: 'All', value: 'all' as const },
					{ label: 'Deploys', value: 'deploys' as const },
					{ label: 'Failures', value: 'failures' as const }
				]}
				selection={filter}
				onChange={setFilter}
			/>
			<GlassCard style={{ overflow: 'hidden' }}>
				{recent.loading ? (
					<WidgetLoading />
				) : groups.length === 0 ? (
					<WidgetMessage text={recent.failed ? 'Unavailable' : 'No recent activity'} />
				) : (
					<WidgetRows
						items={groups}
						keyFor={(group) => group.key}
						labelFor={({ activity }) => `${activityTitle(activity)}, ${activity.status}`}
						onPress={(group) =>
							onOpenActivity(group.activity.status === 'failed' ? 'failed' : undefined)
						}
					>
						{({ activity, ids }) => {
							const title = activityTitle(activity);
							const at = activityTime(activity);
							return (
								<>
									<Dot color={activityStatusTint(activity.status)} />
									<RowText
										title={[
											activity.status === 'failed' ? `${title} failed` : title,
											activity.resourceName
										]
											.filter(Boolean)
											.join(' · ')}
										environmentID={activityEnvironmentID(activity)}
										model={model}
										badge={ids.length}
									/>
									{at !== undefined ? <TrailingCaption text={relativeNamed(at)} /> : null}
								</>
							);
						}}
					</WidgetRows>
				)}
				<View style={{ height: 1, marginLeft: 16, backgroundColor: colors.separator }} />
				<Pressable
					onPress={() => onOpenActivity()}
					android_ripple={{ color: colors.separator as string }}
					accessibilityRole="button"
					style={{ paddingHorizontal: 16, paddingVertical: 12 }}
				>
					<Text style={[m3Type.labelLarge, { color: m3.primary }]}>View All</Text>
				</Pressable>
			</GlassCard>
		</View>
	);
}

function JobsWidget({
	model,
	onOpenJobs
}: {
	model: AllEnvironmentsDashboardModel;
	onOpenJobs: (environmentID: string) => void;
}) {
	const upcoming = useUpcomingJobs();
	return (
		<View style={{ gap: 14 }}>
			<WidgetHeader title="Upcoming Jobs" />
			<GlassCard style={{ overflow: 'hidden' }}>
				{upcoming.loading ? (
					<WidgetLoading />
				) : upcoming.jobs.length === 0 ? (
					<WidgetMessage text={upcoming.failed ? 'Unavailable' : 'No upcoming jobs'} />
				) : (
					<WidgetRows
						items={upcoming.jobs}
						keyFor={(entry) => `${entry.environmentID}:${entry.job.id}`}
						labelFor={(entry) => `${jobLabel(entry.job)}, ${relativeNamed(entry.nextRun)}`}
						onPress={(entry) => onOpenJobs(entry.environmentID)}
					>
						{(entry) => (
							<>
								<RowText
									title={jobLabel(entry.job)}
									environmentID={entry.environmentID}
									model={model}
								/>
								<TrailingCaption text={relativeNamed(entry.nextRun)} />
							</>
						)}
					</WidgetRows>
				)}
			</GlassCard>
		</View>
	);
}

function ReclaimableWidget({
	model,
	onPrune
}: {
	model: AllEnvironmentsDashboardModel;
	onPrune: (() => void) | undefined;
}) {
	const reclaimable = useReclaimable();
	return (
		<View style={{ gap: 14 }}>
			<WidgetHeader title="Reclaimable Space">
				{onPrune && reclaimable.total > 0 ? (
					<Pressable
						onPress={onPrune}
						accessibilityRole="button"
						android_ripple={{ color: colors.separator as string, borderless: false }}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 6,
							height: 36,
							paddingHorizontal: 14,
							borderRadius: 18,
							borderWidth: 1,
							borderColor: m3.outline
						}}
					>
						<Icon name="trash" size={16} color={m3.primary} />
						<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Prune</Text>
					</Pressable>
				) : null}
			</WidgetHeader>
			<GlassCard style={{ overflow: 'hidden' }}>
				{reclaimable.loading ? (
					<WidgetLoading />
				) : reclaimable.total === 0 ? (
					<WidgetMessage text={reclaimable.failed ? 'Unavailable' : 'Nothing to reclaim'} />
				) : (
					<View style={{ padding: 16, gap: 14 }}>
						<Text
							style={[
								m3Type.headlineSmall,
								{ color: colors.label, fontWeight: '600', fontVariant: ['tabular-nums'] }
							]}
						>
							{byteString(reclaimable.total)}
						</Text>
						{reclaimable.resources.map((resource) => (
							<View
								key={resource.key}
								accessible
								accessibilityLabel={`${resource.title}: ${byteString(resource.total)}`}
								style={{ gap: 6 }}
							>
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
									<Text
										numberOfLines={1}
										style={[m3Type.bodyMedium, { flex: 1, color: colors.secondaryLabel }]}
									>
										{resource.title}
									</Text>
									<Text
										style={[
											m3Type.titleSmall,
											{ color: colors.label, fontVariant: ['tabular-nums'] }
										]}
									>
										{byteString(resource.total)}
									</Text>
								</View>
								<View style={{ flexDirection: 'row', height: 8, gap: 2 }}>
									{resource.segments.map((segment) => (
										<View
											key={segment.environmentID}
											style={{
												flexGrow: segment.bytes,
												flexBasis: 0,
												height: 8,
												borderRadius: 4,
												backgroundColor: model.environmentColor(segment.environmentID)
											}}
										/>
									))}
								</View>
							</View>
						))}
						{reclaimable.environmentCount > 1 ? (
							<View>
								{reclaimable.topEnvironments.map((entry, index) => (
									<View key={entry.environmentID}>
										{index > 0 ? (
											<View style={{ height: 1, backgroundColor: colors.separator }} />
										) : null}
										<View
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												gap: 8,
												paddingVertical: 8
											}}
										>
											<Dot color={model.environmentColor(entry.environmentID)} />
											<Text
												numberOfLines={1}
												style={[m3Type.titleSmall, { flex: 1, color: colors.label }]}
											>
												{model.environmentName(entry.environmentID) ?? entry.environmentID}
											</Text>
											<TrailingCaption text={byteString(entry.bytes)} />
										</View>
									</View>
								))}
							</View>
						) : null}
					</View>
				)}
			</GlassCard>
		</View>
	);
}

function TopMemoryWidget({
	model,
	onOpenContainer
}: {
	model: AllEnvironmentsDashboardModel;
	onOpenContainer: (container: ContainerSummary, environmentID: string) => void;
}) {
	const top = useTopMemory(model);
	return (
		<View style={{ gap: 14 }}>
			<WidgetHeader title="Top Memory" />
			<GlassCard style={{ overflow: 'hidden' }}>
				{top.entries.length === 0 ? (
					top.loading ? (
						<WidgetLoading />
					) : (
						<WidgetMessage text="No running containers" />
					)
				) : (
					<WidgetRows
						items={top.entries}
						keyFor={(entry) => entry.id}
						labelFor={(entry) =>
							`${containerDisplayName(entry.container)}, ${ResourceMetricsText.memoryUsed(entry.sample)}`
						}
						onPress={(entry) => onOpenContainer(entry.container, entry.environmentID)}
					>
						{(entry) => (
							<>
								<RowText
									title={containerDisplayName(entry.container)}
									environmentID={entry.environmentID}
									model={model}
								/>
								<TrailingCaption text={ResourceMetricsText.memoryUsed(entry.sample)} />
							</>
						)}
					</WidgetRows>
				)}
			</GlassCard>
		</View>
	);
}

function EnvironmentsWidget({
	model,
	props
}: {
	model: AllEnvironmentsDashboardModel;
	props: AllEnvironmentsDashboardProps;
}) {
	return (
		<View style={{ gap: 14 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<View style={{ flex: 1, gap: 2 }}>
					<DashboardSectionTitle title="Environments" />
					<Text
						style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
					>{`${model.onlineCount} of ${model.environments.length} online`}</Text>
				</View>
				{props.hostsAccessory}
			</View>
			<GlassCard style={{ paddingVertical: 4, overflow: 'hidden' }}>
				{model.environments.map((environment, index) => (
					<HostRow
						key={environment.id}
						model={model}
						environment={environment}
						index={index}
						info={props.dockerInfo[environment.id]}
						volumes={props.volumeCounts[environment.id]}
						onOpenEnvironment={props.onOpenEnvironment}
					/>
				))}
			</GlassCard>
		</View>
	);
}

function PanelWidget({
	id,
	model,
	props
}: {
	id: DashboardWidgetID;
	model: AllEnvironmentsDashboardModel;
	props: AllEnvironmentsDashboardProps;
}) {
	switch (id) {
		case 'environments':
			return <EnvironmentsWidget model={model} props={props} />;
		case 'usage':
			return (
				<View style={{ gap: 14 }}>
					<WidgetHeader title="Usage" />
					<UsageCard model={model} />
				</View>
			);
		case 'busiest':
			return <BusiestSection model={model} onOpenContainer={props.onOpenContainer} />;
		case 'attention':
			return <AttentionWidget model={model} onAction={props.onAttention} />;
		case 'activity':
			return <ActivityWidget model={model} onOpenActivity={props.onOpenActivity} />;
		case 'jobs':
			return <JobsWidget model={model} onOpenJobs={props.onOpenJobs} />;
		case 'reclaimable':
			return (
				<ReclaimableWidget model={model} onPrune={props.canPrune ? props.onPrune : undefined} />
			);
		case 'memory':
			return <TopMemoryWidget model={model} onOpenContainer={props.onOpenContainer} />;
		default:
			return null;
	}
}

export function AllEnvironmentsDashboard(props: AllEnvironmentsDashboardProps) {
	const model = useAllEnvironmentsDashboard(props.environments, props.counts, props.isAdmin);
	const firstStats = model.groups.findIndex((group) => group.kind === 'stats');
	return (
		<View style={{ gap: 36 }}>
			{model.groups.map((group, index) => (
				<CardEntranceView
					key={group.key}
					id={`dashboard.widget.${group.key}`}
					index={Math.min(index, 5)}
					style={{ gap: 10 }}
				>
					{group.kind === 'stats' ? (
						<>
							{chunk(group.ids, 2).map((pair) => (
								<View key={pair.join('|')} style={{ flexDirection: 'row', gap: 12 }}>
									{pair.map((id) => (
										<StatWidget key={id} id={id} model={model} props={props} />
									))}
									{pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
								</View>
							))}
							{index === firstStats ? props.totalsFootnote : null}
						</>
					) : (
						<PanelWidget id={group.id} model={model} props={props} />
					)}
				</CardEntranceView>
			))}
			<Pressable
				onPress={props.onEditLayout}
				accessibilityRole="button"
				android_ripple={{ color: colors.separator as string }}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 8,
					height: 40,
					borderRadius: 20,
					borderWidth: 1,
					borderColor: m3.outline
				}}
			>
				<Icon name="square.grid.2x2" size={18} color={m3.primary} />
				<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Edit Dashboard</Text>
			</Pressable>
		</View>
	);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
	return rows;
}
