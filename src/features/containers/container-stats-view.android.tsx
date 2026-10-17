/** Android rendering of `ContainerStatsView` (ContainerStatsView.swift). */
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { EnvironmentID } from '@/sdk/client/environment';
import { useAccentColor } from '@/theme/accent';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ErrorBanner } from '@/ui/components/error-banner';
import { SkeletonRect, SkeletonShimmer } from '@/ui/components/skeleton';
import { DashboardCard } from '@/ui/components/surfaces';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { StatsText } from './container-stats-frame';
import { StatsLineChart, type ChartSeries } from './stats-chart';
import { useContainerStats } from './use-container-stats';

function Card({ children }: { children: ReactNode }) {
	return (
		<DashboardCard cornerRadius={Radius.standard} style={{ padding: 12, gap: 8 }}>
			{children}
		</DashboardCard>
	);
}

function ChartCard({
	title,
	legend,
	trailing,
	series
}: {
	title: string;
	legend?: { name: string; color: string }[];
	trailing?: string;
	series: ChartSeries[];
}) {
	return (
		<Card>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<Text style={[m3Type.titleMedium, { color: colors.label, flex: 1 }]}>{title}</Text>
				{trailing ? (
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{trailing}</Text>
				) : null}
				{legend?.map((entry) => (
					<View
						key={entry.name}
						style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 10 }}
					>
						<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: entry.color }} />
						<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>{entry.name}</Text>
					</View>
				))}
			</View>
			<StatsLineChart series={series} />
		</Card>
	);
}

function Tile({
	title,
	value,
	subtitle,
	icon,
	tint
}: {
	title: string;
	value: string;
	subtitle?: string;
	icon: string;
	tint: string;
}) {
	return (
		<DashboardCard cornerRadius={Radius.standard} style={{ flex: 1, padding: 12, gap: 6 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
				<Icon name={icon} size={16} color={tint} />
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{title}</Text>
			</View>
			<Text
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.6}
				style={[m3Type.titleLarge, { color: colors.label, fontWeight: '700' }]}
			>
				{value}
			</Text>
			{subtitle !== undefined ? (
				<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>{subtitle}</Text>
			) : null}
		</DashboardCard>
	);
}

function SkeletonStats() {
	const tile = (
		<DashboardCard cornerRadius={Radius.standard} style={{ flex: 1, padding: 12, gap: 6 }}>
			<SkeletonRect width={70} height={12} />
			<SkeletonRect width={90} height={18} />
			<SkeletonRect width={60} height={10} />
		</DashboardCard>
	);
	return (
		<SkeletonShimmer>
			<View style={{ gap: 16 }} importantForAccessibility="no-hide-descendants">
				<View style={{ flexDirection: 'row', gap: 12 }}>
					{tile}
					{tile}
				</View>
				<View style={{ flexDirection: 'row', gap: 12 }}>
					{tile}
					{tile}
				</View>
				{[0, 1, 2, 3].map((index) => (
					<Card key={index}>
						<SkeletonRect width={90} height={16} />
						<SkeletonRect height={140} cornerRadius={Radius.nested} />
					</Card>
				))}
			</View>
		</SkeletonShimmer>
	);
}

export function ContainerStatsView({
	environmentID,
	containerID
}: {
	environmentID: EnvironmentID;
	containerID: string;
}) {
	const accent = useAccentColor();
	const { frames, latest, series, errorMessage, retry } = useContainerStats(
		environmentID,
		containerID
	);

	return (
		<ScrollView
			style={{ backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ padding: 16, gap: 16 }}
		>
			{errorMessage ? (
				<ErrorBanner message={errorMessage} severity="warning" retry={retry} />
			) : null}
			{frames.length === 0 ? (
				errorMessage === undefined ? (
					<SkeletonStats />
				) : null
			) : (
				<>
					<View style={{ flexDirection: 'row', gap: 12 }}>
						<Tile
							title="CPU"
							value={StatsText.percent(latest?.cpuPercent)}
							icon="cpu"
							tint={accent}
						/>
						<Tile
							title="Memory"
							value={StatsText.memory(latest?.memoryUsed)}
							subtitle={StatsText.percent(latest?.memoryPercent)}
							icon="memorychip"
							tint={accent}
						/>
					</View>
					<View style={{ flexDirection: 'row', gap: 12 }}>
						<Tile
							title="Network"
							value={`↓ ${StatsText.rate(latest?.netRxPerSec)}`}
							subtitle={`↑ ${StatsText.rate(latest?.netTxPerSec)}`}
							icon="network"
							tint={systemColors.green}
						/>
						<Tile
							title="Block I/O"
							value={`R ${StatsText.rate(latest?.blockReadPerSec)}`}
							subtitle={`W ${StatsText.rate(latest?.blockWritePerSec)}`}
							icon="internaldrive"
							tint={accent}
						/>
					</View>
					<ChartCard title="CPU" series={[{ values: series.cpu, color: accent }]} />
					<ChartCard
						title="Memory"
						trailing={
							latest && latest.memoryLimit > 0
								? `${StatsText.memory(latest.memoryUsed)} / ${StatsText.memory(latest.memoryLimit)}`
								: undefined
						}
						series={[
							{ values: series.memoryMegabytes, color: systemColors.indigo, fillOpacity: 0.25 }
						]}
					/>
					<ChartCard
						title="Network I/O"
						legend={[
							{ name: 'RX', color: systemColors.green },
							{ name: 'TX', color: systemColors.orange }
						]}
						series={[
							{ values: series.networkReceive, color: systemColors.green },
							{ values: series.networkTransmit, color: systemColors.orange }
						]}
					/>
					<ChartCard
						title="Block I/O"
						legend={[
							{ name: 'Read', color: accent },
							{ name: 'Write', color: withOpacity(accent, 0.5) }
						]}
						series={[
							{ values: series.blockRead, color: accent },
							{ values: series.blockWrite, color: withOpacity(accent, 0.5) }
						]}
					/>
				</>
			)}
		</ScrollView>
	);
}
