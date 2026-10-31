import {
	Button,
	Circle,
	Divider,
	Grid,
	HStack,
	Picker,
	RNHostView,
	Spacer,
	Text,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	background,
	buttonStyle,
	contentShape,
	contentTransition,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	minimumScaleFactor,
	monospacedDigit,
	opacity,
	padding,
	pickerStyle,
	shapes,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { pluralCount } from '@/core/plural';
import { activityStatusTint } from '@/features/activities/activity-display';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import type { BusiestEntry } from '@/stores/busiest-containers-logic';
import { environmentIsOnline } from '@/stores/dashboard-stream-logic';
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
	byteString,
	containerDisplayName,
	containerIconURL,
	containerIsRunning,
	displayName,
	percent0,
	ResourceMetricsText,
	type UsageMetric
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
import type { AllEnvironmentsDashboardProps } from './all-environments-dashboard.types';
import { DashboardRowChevron, DashboardSectionTitle } from './dashboard-parts';
import { useEnvironmentCounts } from '../use-environment-counts';
import { MetricRing } from './metric-ring';
import { UsageChart } from './usage-chart';

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

function UsageCard({ model }: { model: AllEnvironmentsDashboardModel }) {
	const usage = useUsageCard(model);
	const reduceMotion = useReduceMotion();
	const headlineValue = usage.headline?.value ?? '—';
	return (
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
						{usage.headline ? (
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{usage.headline.detail}
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

				{usage.waitingForStats ? (
					<VStack modifiers={[frame({ maxWidth: Infinity, minHeight: 150 })]}>
						<ArcaneLoadingViewSwiftUI label="Waiting for live stats…" variant="inline" />
					</VStack>
				) : (
					<HStack modifiers={[frame({ maxWidth: Infinity, minHeight: 150, maxHeight: 150 })]}>
						<RNHostView>
							<View style={{ flex: 1, height: 150 }}>
								<UsageChart lines={usage.usageLines} metric={model.usageMetric} />
							</View>
						</RNHostView>
					</HStack>
				)}

				{usage.usageLines.length > 0 ? (
					<Grid horizontalSpacing={10} verticalSpacing={8} alignment="leading">
						{chunk(usage.usageLines, 2).map((pair, rowIndex) => (
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
}

function BusiestSection({
	model,
	onOpenContainer
}: {
	model: AllEnvironmentsDashboardModel;
	onOpenContainer: (container: ContainerSummary, environmentID: string) => void;
}) {
	const busiest = useBusiestCard(model);
	const reduceMotion = useReduceMotion();
	return (
		<VStack alignment="leading" spacing={14}>
			<HStack>
				<VStack alignment="leading" spacing={2}>
					<DashboardSectionTitle title="Busiest Containers" />
					{!busiest.isLive && busiest.updatedAt !== undefined && busiest.entries.length > 0 ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>{`Updated ${relativeNamed(busiest.updatedAt)}`}</Text>
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
							hashKey(busiest.entries.map((e) => e.id).join('|')),
							reduceMotion
						)
					]}
				>
					{busiest.entries.length === 0 ? (
						<VStack
							modifiers={[
								font({ textStyle: 'subheadline' }),
								frame({ maxWidth: Infinity }),
								padding({ vertical: 20 })
							]}
						>
							{busiest.isLive ? (
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									No running containers.
								</Text>
							) : (
								<ArcaneLoadingViewSwiftUI label="Sampling containers…" variant="inline" />
							)}
						</VStack>
					) : (
						busiest.entries.map((entry, index) => (
							<VStack key={entry.id} spacing={0}>
								{index > 0 ? <Divider modifiers={[padding({ leading: 64 })]} /> : null}
								<Button
									onPress={() => onOpenContainer(entry.container, entry.environmentID)}
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
	const label = [
		displayName(environment),
		isOnline ? 'online' : 'offline',
		info ? `${running} of ${total} containers running` : undefined,
		images !== undefined ? pluralCount(images, 'image') : undefined,
		volumes !== undefined ? pluralCount(volumes, 'volume') : undefined,
		disk !== undefined ? `disk ${disk.toFixed(0)} percent full` : undefined
	]
		.filter(Boolean)
		.join(', ');
	return (
		<VStack spacing={0}>
			{index > 0 ? <Divider modifiers={[padding({ leading: 16 })]} /> : null}
			<Button onPress={() => onOpenEnvironment(environment)} modifiers={[cardRowLinkStyle()]}>
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
							modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), lineLimit(1)]}
						>
							{displayName(environment)}
						</Text>
						<Spacer minLength={8} />
						{!isOnline ? (
							<Text
								modifiers={[font({ textStyle: 'caption' }), foregroundStyle(systemColors.orange)]}
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
								fraction: total !== undefined && total > 0 ? (running ?? 0) / total : undefined,
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
}

function WidgetHeader({ title, children }: { title: string; children?: ReactNode }) {
	return (
		<HStack>
			<DashboardSectionTitle title={title} />
			<Spacer />
			{children}
		</HStack>
	);
}

function WidgetMessage({ text }: { text: string }) {
	return (
		<Text
			modifiers={[
				font({ textStyle: 'subheadline' }),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				frame({ maxWidth: Infinity, alignment: 'leading' }),
				padding({ horizontal: 16, vertical: 14 })
			]}
		>
			{text}
		</Text>
	);
}

function WidgetLoading() {
	return (
		<VStack modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 20 })]}>
			<ArcaneLoadingViewSwiftUI variant="inline" />
		</VStack>
	);
}

function WidgetRows<T>({
	items,
	keyFor,
	onPress,
	children
}: {
	items: readonly T[];
	keyFor: (item: T) => string;
	onPress?: (item: T) => void;
	children: (item: T) => ReactNode;
}) {
	return (
		<VStack spacing={0} modifiers={[padding({ vertical: 4 })]}>
			{items.map((item, index) => (
				<VStack key={keyFor(item)} spacing={0}>
					{index > 0 ? <Divider modifiers={[padding({ leading: 16 })]} /> : null}
					{onPress ? (
						<Button onPress={() => onPress(item)} modifiers={[cardRowLinkStyle()]}>
							<HStack
								spacing={12}
								modifiers={[
									padding({ horizontal: 16, vertical: 10 }),
									contentShape(shapes.rectangle())
								]}
							>
								{children(item)}
							</HStack>
						</Button>
					) : (
						<HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 10 })]}>
							{children(item)}
						</HStack>
					)}
				</VStack>
			))}
		</VStack>
	);
}

function Dot({ color }: { color: string }) {
	return (
		<Circle
			modifiers={[
				foregroundStyle(color),
				frame({ width: 8, height: 8 }),
				accessibilityHidden(true)
			]}
		/>
	);
}

function TrailingCaption({ text }: { text: string }) {
	return (
		<Text
			modifiers={[
				font({ textStyle: 'caption' }),
				monospacedDigit(),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				lineLimit(1),
				fixedSize()
			]}
		>
			{text}
		</Text>
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
	const reduceMotion = useReduceMotion();
	const info = DashboardWidget.info[id];
	const shown = loading ? '—' : (value ?? '—');
	const content = (
		<GlassCardBackground>
			<VStack
				alignment="leading"
				spacing={6}
				modifiers={[
					padding({ horizontal: 14, vertical: 12 }),
					frame({ maxWidth: Infinity, alignment: 'leading' }),
					contentShape(shapes.rectangle()),
					accessibilityElement('ignore'),
					accessibilityLabel(`${info.title}: ${shown}, ${detail}`)
				]}
			>
				<HStack spacing={5}>
					<Image
						systemName={info.systemImage as SFSymbol}
						modifiers={[
							font({ textStyle: 'caption', weight: 'semibold' }),
							foregroundStyle(systemColors[info.tint])
						]}
					/>
					<Text
						modifiers={[
							font({ textStyle: 'caption', weight: 'medium' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(1)
						]}
					>
						{info.title}
					</Text>
				</HStack>
				<Text
					modifiers={[
						font({ textStyle: 'title2', design: 'rounded', weight: 'semibold' }),
						monospacedDigit(),
						lineLimit(1),
						minimumScaleFactor(0.6),
						contentTransition('numericText'),
						...motionAwareAnimation(Motion.state, hashKey(shown), reduceMotion)
					]}
				>
					{shown}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					{detail}
				</Text>
			</VStack>
		</GlassCardBackground>
	);
	if (!onPress) return content;
	return (
		<Button
			onPress={onPress}
			modifiers={[buttonStyle('plain'), accessibilityAddTraits(['isButton'])]}
		>
			{content}
		</Button>
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

function CountBadge({ count }: { count: number | undefined }) {
	if (!count || count < 2) return null;
	return (
		<Text
			modifiers={[
				font({ textStyle: 'caption2', weight: 'semibold' }),
				monospacedDigit(),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				padding({ horizontal: 6, vertical: 2 }),
				background(withOpacity('#8E8E93', 0.16), shapes.capsule()),
				fixedSize()
			]}
		>
			{`×${count}`}
		</Text>
	);
}

function AttentionWidget({
	model,
	onAction
}: {
	model: AllEnvironmentsDashboardModel;
	onAction: (action: OverviewAttentionAction) => void;
}) {
	const accent = useAccentColor();
	const attention = useOverviewAttention(model);
	const [sort, setSort] = useState<OverviewAttentionSort>('impact');
	const items = sortOverviewAttention(attention.items, sort).slice(0, overviewListLimit);
	return (
		<VStack alignment="leading" spacing={14}>
			<WidgetHeader title="Needs Attention">
				<Picker<OverviewAttentionSort>
					label="Sort"
					selection={sort}
					onSelectionChange={setSort}
					modifiers={[pickerStyle('segmented'), fixedSize()]}
				>
					<Text modifiers={[tag('impact')]}>Impact</Text>
					<Text modifiers={[tag('newest')]}>Newest</Text>
				</Picker>
			</WidgetHeader>
			<GlassCardBackground>
				{attention.loading ? (
					<WidgetLoading />
				) : items.length === 0 ? (
					<WidgetMessage text={attention.failed ? 'Unavailable' : 'No issues'} />
				) : (
					<WidgetRows
						items={items}
						keyFor={(item) => item.key}
						onPress={(item) => onAction(item.action)}
					>
						{(item) => (
							<>
								<Dot color={severityColor(item.severity)} />
								<VStack alignment="leading" spacing={3}>
									<HStack spacing={6}>
										<Text
											modifiers={[
												font({ textStyle: 'subheadline', weight: 'medium' }),
												lineLimit(1)
											]}
										>
											{item.title}
										</Text>
										<CountBadge count={item.count} />
									</HStack>
									<EnvironmentLabel
										name={model.environmentName(item.environmentID)}
										color={model.environmentColor(item.environmentID)}
									/>
									{item.detail ? (
										<Text
											modifiers={[
												font({ textStyle: 'caption' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
												lineLimit(1)
											]}
										>
											{item.detail}
										</Text>
									) : null}
								</VStack>
								<Spacer minLength={8} />
								<Text
									modifiers={[
										font({ textStyle: 'subheadline', weight: 'medium' }),
										foregroundStyle(accent),
										fixedSize()
									]}
								>
									{item.actionLabel}
								</Text>
							</>
						)}
					</WidgetRows>
				)}
			</GlassCardBackground>
		</VStack>
	);
}

function ActivityWidget({
	model,
	onOpenActivity
}: {
	model: AllEnvironmentsDashboardModel;
	onOpenActivity: (status?: 'failed') => void;
}) {
	const accent = useAccentColor();
	const recent = useRecentActivity();
	const [filter, setFilter] = useState<ActivityFilter>('all');
	const groups = filterActivityGroups(recent.groups, filter);
	return (
		<VStack alignment="leading" spacing={14}>
			<DashboardSectionTitle title="Recent Activity" />
			<Picker<ActivityFilter>
				label="Filter"
				selection={filter}
				onSelectionChange={setFilter}
				modifiers={[pickerStyle('segmented')]}
			>
				<Text modifiers={[tag('all')]}>All</Text>
				<Text modifiers={[tag('deploys')]}>Deploys</Text>
				<Text modifiers={[tag('failures')]}>Failures</Text>
			</Picker>
			<GlassCardBackground>
				<VStack alignment="leading" spacing={0}>
					{recent.loading ? (
						<WidgetLoading />
					) : groups.length === 0 ? (
						<WidgetMessage text={recent.failed ? 'Unavailable' : 'No recent activity'} />
					) : (
						<WidgetRows
							items={groups}
							keyFor={(group) => group.key}
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
										<VStack alignment="leading" spacing={3}>
											<HStack spacing={6}>
												<Text
													modifiers={[
														font({ textStyle: 'subheadline', weight: 'medium' }),
														lineLimit(1)
													]}
												>
													{[
														activity.status === 'failed' ? `${title} failed` : title,
														activity.resourceName
													]
														.filter(Boolean)
														.join(' · ')}
												</Text>
												<CountBadge count={ids.length} />
											</HStack>
											<EnvironmentLabel
												name={model.environmentName(activityEnvironmentID(activity))}
												color={model.environmentColor(activityEnvironmentID(activity))}
											/>
										</VStack>
										<Spacer minLength={8} />
										{at !== undefined ? <TrailingCaption text={relativeNamed(at)} /> : null}
									</>
								);
							}}
						</WidgetRows>
					)}
					<Divider modifiers={[padding({ leading: 16 })]} />
					<Button onPress={() => onOpenActivity()} modifiers={[cardRowLinkStyle()]}>
						<HStack
							modifiers={[
								padding({ horizontal: 16, vertical: 12 }),
								contentShape(shapes.rectangle())
							]}
						>
							<Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(accent)]}>
								View All
							</Text>
							<Spacer />
						</HStack>
					</Button>
				</VStack>
			</GlassCardBackground>
		</VStack>
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
		<VStack alignment="leading" spacing={14}>
			<WidgetHeader title="Upcoming Jobs" />
			<GlassCardBackground>
				{upcoming.loading ? (
					<WidgetLoading />
				) : upcoming.jobs.length === 0 ? (
					<WidgetMessage text={upcoming.failed ? 'Unavailable' : 'No upcoming jobs'} />
				) : (
					<WidgetRows
						items={upcoming.jobs}
						keyFor={(entry) => `${entry.environmentID}:${entry.job.id}`}
						onPress={(entry) => onOpenJobs(entry.environmentID)}
					>
						{(entry) => (
							<>
								<VStack alignment="leading" spacing={3}>
									<Text
										modifiers={[font({ textStyle: 'subheadline', weight: 'medium' }), lineLimit(1)]}
									>
										{jobLabel(entry.job)}
									</Text>
									<EnvironmentLabel
										name={model.environmentName(entry.environmentID)}
										color={model.environmentColor(entry.environmentID)}
									/>
								</VStack>
								<Spacer minLength={8} />
								<TrailingCaption text={relativeNamed(entry.nextRun)} />
							</>
						)}
					</WidgetRows>
				)}
			</GlassCardBackground>
		</VStack>
	);
}

function SegmentBar({ segments }: { segments: { key: string; weight: number; color: string }[] }) {
	return (
		<HStack
			modifiers={[
				frame({ maxWidth: Infinity, minHeight: 8, maxHeight: 8 }),
				accessibilityHidden(true)
			]}
		>
			<RNHostView>
				<View style={{ flex: 1, height: 8, flexDirection: 'row', gap: 2 }}>
					{segments.map((segment) => (
						<View
							key={segment.key}
							style={{
								flexGrow: segment.weight,
								flexBasis: 0,
								height: 8,
								borderRadius: 4,
								backgroundColor: segment.color
							}}
						/>
					))}
				</View>
			</RNHostView>
		</HStack>
	);
}

function ReclaimableWidget({
	model,
	onPrune
}: {
	model: AllEnvironmentsDashboardModel;
	onPrune: (() => void) | undefined;
}) {
	const reduceMotion = useReduceMotion();
	const reclaimable = useReclaimable();
	const total = byteString(reclaimable.total);
	return (
		<VStack alignment="leading" spacing={14}>
			<WidgetHeader title="Reclaimable Space">
				{onPrune && reclaimable.total > 0 ? (
					<Button
						label="Prune"
						systemImage="trash"
						onPress={onPrune}
						modifiers={[buttonStyle('bordered'), font({ textStyle: 'subheadline' })]}
					/>
				) : null}
			</WidgetHeader>
			<GlassCardBackground>
				{reclaimable.loading ? (
					<WidgetLoading />
				) : reclaimable.total === 0 ? (
					<WidgetMessage text={reclaimable.failed ? 'Unavailable' : 'Nothing to reclaim'} />
				) : (
					<VStack alignment="leading" spacing={14} modifiers={[padding({ all: 16 })]}>
						<Text
							modifiers={[
								font({ textStyle: 'title', design: 'rounded', weight: 'semibold' }),
								monospacedDigit(),
								contentTransition('numericText'),
								...motionAwareAnimation(Motion.state, hashKey(total), reduceMotion)
							]}
						>
							{total}
						</Text>
						{reclaimable.resources.map((resource) => (
							<VStack
								key={resource.key}
								alignment="leading"
								spacing={6}
								modifiers={[
									accessibilityElement('ignore'),
									accessibilityLabel(`${resource.title}: ${byteString(resource.total)}`)
								]}
							>
								<HStack modifiers={[font({ textStyle: 'subheadline' })]}>
									<Text
										modifiers={[
											foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
											lineLimit(1)
										]}
									>
										{resource.title}
									</Text>
									<Spacer minLength={8} />
									<Text modifiers={[font({ weight: 'medium' }), monospacedDigit()]}>
										{byteString(resource.total)}
									</Text>
								</HStack>
								<SegmentBar
									segments={resource.segments.map((segment) => ({
										key: segment.environmentID,
										weight: segment.bytes,
										color: model.environmentColor(segment.environmentID)
									}))}
								/>
							</VStack>
						))}
						{reclaimable.environmentCount > 1 ? (
							<VStack spacing={0}>
								{reclaimable.topEnvironments.map((entry, index) => (
									<VStack key={entry.environmentID} spacing={0}>
										{index > 0 ? <Divider /> : null}
										<HStack
											spacing={8}
											modifiers={[font({ textStyle: 'subheadline' }), padding({ vertical: 8 })]}
										>
											<Dot color={model.environmentColor(entry.environmentID)} />
											<Text modifiers={[font({ weight: 'medium' }), lineLimit(1)]}>
												{model.environmentName(entry.environmentID) ?? entry.environmentID}
											</Text>
											<Spacer minLength={8} />
											<Text
												modifiers={[
													monospacedDigit(),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											>
												{byteString(entry.bytes)}
											</Text>
										</HStack>
									</VStack>
								))}
							</VStack>
						) : null}
					</VStack>
				)}
			</GlassCardBackground>
		</VStack>
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
		<VStack alignment="leading" spacing={14}>
			<WidgetHeader title="Top Memory" />
			<GlassCardBackground>
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
						onPress={(entry) => onOpenContainer(entry.container, entry.environmentID)}
					>
						{(entry) => (
							<>
								<VStack alignment="leading" spacing={3}>
									<Text
										modifiers={[font({ textStyle: 'subheadline', weight: 'medium' }), lineLimit(1)]}
									>
										{containerDisplayName(entry.container)}
									</Text>
									<EnvironmentLabel
										name={model.environmentName(entry.environmentID)}
										color={model.environmentColor(entry.environmentID)}
									/>
								</VStack>
								<Spacer minLength={8} />
								<Text
									modifiers={[
										font({ textStyle: 'subheadline' }),
										monospacedDigit(),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
										contentTransition('numericText'),
										fixedSize()
									]}
								>
									{ResourceMetricsText.memoryUsed(entry.sample)}
								</Text>
							</>
						)}
					</WidgetRows>
				)}
			</GlassCardBackground>
		</VStack>
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
		<VStack alignment="leading" spacing={14}>
			<HStack>
				<VStack alignment="leading" spacing={2}>
					<DashboardSectionTitle title="Environments" />
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>{`${model.onlineCount} of ${model.environments.length} online`}</Text>
				</VStack>
				<Spacer />
				{props.hostsAccessory}
			</HStack>
			<GlassCardBackground>
				<VStack spacing={0} modifiers={[padding({ vertical: 4 })]}>
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
				</VStack>
			</GlassCardBackground>
		</VStack>
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
				<VStack alignment="leading" spacing={14}>
					<WidgetHeader title="Usage" />
					<UsageCard model={model} />
				</VStack>
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
		<VStack alignment="leading" spacing={36}>
			{model.groups.map((group, index) => (
				<CardEntrance
					key={group.key}
					id={`dashboard.widget.${group.key}`}
					index={Math.min(index, 5)}
				>
					{group.kind === 'stats' ? (
						<VStack alignment="leading" spacing={10}>
							<Grid horizontalSpacing={12} verticalSpacing={12} alignment="topLeading">
								{chunk(group.ids, 2).map((pair) => (
									<Grid.Row key={pair.join('|')}>
										{pair.map((id) => (
											<StatWidget key={id} id={id} model={model} props={props} />
										))}
										{pair.length === 1 ? (
											<Spacer modifiers={[frame({ maxWidth: Infinity })]} />
										) : null}
									</Grid.Row>
								))}
							</Grid>
							{index === firstStats ? props.totalsFootnote : null}
						</VStack>
					) : (
						<PanelWidget id={group.id} model={model} props={props} />
					)}
				</CardEntrance>
			))}
			<Button
				label="Edit Dashboard"
				systemImage="square.grid.2x2"
				onPress={props.onEditLayout}
				modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity })]}
			/>
		</VStack>
	);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
	return rows;
}
