import { Host } from '@/ui/host';
import {
	Circle,
	Grid,
	HStack,
	RNHostView,
	ScrollView,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	minimumScaleFactor,
	padding
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { EnvironmentID } from '@/sdk/client/environment';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ErrorBanner } from '@/ui/components/error-banner';
import { SkeletonRect, SkeletonShimmer } from '@/ui/components/skeleton';
import { DashboardCardBackground } from '@/ui/components/swiftui-surfaces';
import { LoadingCrossfade } from '@/ui/components/swiftui-motion';

import { StatsText, type StatsAxisUnit } from './container-stats-frame';
import { StatsLineChart, type ChartSeries } from './stats-chart';
import { useContainerStats } from './use-container-stats';

function Card({ children }: { children: ReactNode }) {
	return (
		<DashboardCardBackground cornerRadius={Radius.standard}>
			<VStack
				alignment="leading"
				spacing={8}
				modifiers={[padding({ all: 12 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}
			>
				{children}
			</VStack>
		</DashboardCardBackground>
	);
}

function Chart({ series, unit }: { series: ChartSeries[]; unit: StatsAxisUnit }) {
	return (
		<HStack
			modifiers={[
				frame({ maxWidth: Infinity, minHeight: 140, maxHeight: 140 }),
				accessibilityHidden(true)
			]}
		>
			<RNHostView>
				<View style={{ flex: 1, height: 140 }}>
					<StatsLineChart series={series} unit={unit} />
				</View>
			</RNHostView>
		</HStack>
	);
}

function ChartCard({
	title,
	legend,
	series,
	unit
}: {
	title: string;
	legend?: { name: string; color: string }[];
	series: ChartSeries[];
	unit: StatsAxisUnit;
}) {
	return (
		<Card>
			<HStack>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{title}</Text>
				<Spacer />
				{legend ? (
					<HStack spacing={10}>
						{legend.map((entry) => (
							<HStack key={entry.name} spacing={4}>
								<Circle
									modifiers={[foregroundStyle(entry.color), frame({ width: 8, height: 8 })]}
								/>
								<Text
									modifiers={[
										font({ textStyle: 'caption2' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>
									{entry.name}
								</Text>
							</HStack>
						))}
					</HStack>
				) : null}
			</HStack>
			<Chart series={series} unit={unit} />
		</Card>
	);
}

function Tile({
	title,
	value,
	subtitle,
	systemImage,
	tint
}: {
	title: string;
	value: string;
	subtitle?: string;
	systemImage: string;
	tint: string;
}) {
	return (
		<DashboardCardBackground cornerRadius={Radius.standard}>
			<VStack
				alignment="leading"
				spacing={6}
				modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 12 })]}
			>
				<HStack spacing={6}>
					<Image systemName={systemImage as SFSymbol} modifiers={[foregroundStyle(tint)]} />
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{title}
					</Text>
				</HStack>
				<Text
					modifiers={[
						font({ textStyle: 'title3', design: 'rounded', weight: 'bold' }),
						lineLimit(1),
						minimumScaleFactor(0.6)
					]}
				>
					{value}
				</Text>
				{subtitle !== undefined ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{subtitle}
					</Text>
				) : null}
			</VStack>
		</DashboardCardBackground>
	);
}

function SkeletonTile() {
	return (
		<DashboardCardBackground cornerRadius={Radius.standard}>
			<VStack
				alignment="leading"
				spacing={6}
				modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 12 })]}
			>
				<SkeletonRect width={70} height={12} />
				<SkeletonRect width={90} height={18} />
				<SkeletonRect width={60} height={10} />
			</VStack>
		</DashboardCardBackground>
	);
}

function SkeletonStats() {
	return (
		<SkeletonShimmer>
			<VStack spacing={16} modifiers={[accessibilityHidden(true)]}>
				<Grid horizontalSpacing={12} verticalSpacing={12}>
					<Grid.Row>
						<SkeletonTile />
						<SkeletonTile />
					</Grid.Row>
					<Grid.Row>
						<SkeletonTile />
						<SkeletonTile />
					</Grid.Row>
				</Grid>
				{[0, 1, 2, 3].map((index) => (
					<Card key={index}>
						<SkeletonRect width={90} height={16} />
						<SkeletonRect height={140} cornerRadius={Radius.nested} />
					</Card>
				))}
			</VStack>
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
		<Host style={{ flex: 1 }}>
			<ScrollView>
				<VStack spacing={16} modifiers={[padding({ all: 16 })]}>
					{errorMessage ? (
						<ErrorBanner message={errorMessage} severity="warning" retry={retry} />
					) : null}
					<LoadingCrossfade
						showSkeleton={frames.length === 0 && errorMessage === undefined}
						skeleton={<SkeletonStats />}
					>
						{frames.length === 0 ? null : (
							<VStack spacing={16}>
								<Grid horizontalSpacing={12} verticalSpacing={12}>
									<Grid.Row>
										<Tile
											title="CPU"
											value={StatsText.percent(latest?.cpuPercent)}
											systemImage="cpu"
											tint={accent}
										/>
										<Tile
											title="Memory"
											value={StatsText.memory(latest?.memoryUsed)}
											subtitle={StatsText.percent(latest?.memoryPercent)}
											systemImage="memorychip"
											tint={accent}
										/>
									</Grid.Row>
									<Grid.Row>
										<Tile
											title="Network"
											value={`↓ ${StatsText.rate(latest?.netRxPerSec)}`}
											subtitle={`↑ ${StatsText.rate(latest?.netTxPerSec)}`}
											systemImage="network"
											tint={systemColors.green}
										/>
										<Tile
											title="Block I/O"
											value={`R ${StatsText.rate(latest?.blockReadPerSec)}`}
											subtitle={`W ${StatsText.rate(latest?.blockWritePerSec)}`}
											systemImage="internaldrive"
											tint={accent}
										/>
									</Grid.Row>
								</Grid>
								<ChartCard
									title="CPU"
									unit="percent"
									series={[{ values: series.cpu, color: accent }]}
								/>
								<Card>
									<HStack>
										<Text modifiers={[font({ textStyle: 'headline' })]}>Memory</Text>
										<Spacer />
										{latest && latest.memoryLimit > 0 ? (
											<Text
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											>
												{`${StatsText.memory(latest.memoryUsed)} / ${StatsText.memory(latest.memoryLimit)}`}
											</Text>
										) : null}
									</HStack>
									<Chart
										unit="bytes"
										series={[
											{
												values: series.memoryBytes,
												color: systemColors.indigo,
												fillOpacity: 0.25
											}
										]}
									/>
								</Card>
								<ChartCard
									title="Network I/O"
									unit="bytesPerSecond"
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
									unit="bytesPerSecond"
									legend={[
										{ name: 'Read', color: accent },
										{ name: 'Write', color: withOpacity(accent, 0.5) }
									]}
									series={[
										{ values: series.blockRead, color: accent },
										{ values: series.blockWrite, color: withOpacity(accent, 0.5) }
									]}
								/>
							</VStack>
						)}
					</LoadingCrossfade>
				</VStack>
			</ScrollView>
		</Host>
	);
}
