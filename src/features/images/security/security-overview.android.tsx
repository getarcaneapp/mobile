/**
 * Android rendering of `SecurityOverviewView`: the same risk score / trend,
 * severity, exposure, drivers, priority findings and riskiest images as
 * Material 3 groups.
 */
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { M3Section } from '@/features/containers/android-material';
import type {
	VulnerabilityRiskFinding,
	VulnerabilityRiskImage,
	VulnerabilityRiskOverview
} from '@/sdk/types/VulnerabilityRiskOverview';
import { colors, systemColors } from '@/theme/colors';
import { SeverityBar } from '@/ui/components/severity-bar';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { MaterialSegmentedButtons } from './material-segmented';
import { releaseRiskScoreMemory, RiskScoreRing } from './risk-score-ring';
import { RiskTrendChart } from './risk-trend-chart';
import {
	deltaPresentation,
	driverChange,
	findingValue,
	overviewPresentation,
	RiskPanels,
	TrendRanges,
	trendPoints,
	type RiskPanel
} from './security-overview-logic';
import { SeverityBadge } from './vulnerability-rows';
import { capitalized, riskBandColor, severityFromRaw } from './vulnerability-model';

let overviewCounter = 0;

export type SecurityOverviewProps = {
	overview: VulnerabilityRiskOverview;
	selectVulnerability: (id: string) => void;
	openImage: (imageID: string, imageName: string) => void;
};

const rowStyle = {
	flexDirection: 'row',
	alignItems: 'center',
	gap: 8,
	minHeight: 48,
	paddingHorizontal: 16,
	paddingVertical: 10
} as const;
const tabular = { fontVariant: ['tabular-nums' as const] };

function ExposureRow({ label, count, color }: { label: string; count: number; color: string }) {
	return (
		<View accessible style={rowStyle}>
			<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{label}</Text>
			<Text style={[m3Type.bodyLarge, tabular, { color: colors.secondaryLabel }]}>
				{String(count)}
			</Text>
		</View>
	);
}

function DriverRow({
	label,
	count,
	previous,
	unavailable
}: {
	label: string;
	count: number;
	previous?: number;
	unavailable: boolean;
}) {
	const change = driverChange(count, previous);
	return (
		<View style={rowStyle}>
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{label}</Text>
			{unavailable ? (
				<Text
					accessibilityLabel="Unavailable"
					style={[m3Type.bodyLarge, { color: colors.secondaryLabel }]}
				>
					–
				</Text>
			) : (
				<>
					<Text style={[m3Type.bodyLarge, tabular, { color: colors.label }]}>{String(count)}</Text>
					{change ? (
						<>
							<Icon name={change.systemImage} size={12} color={change.color} />
							<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
								{change.amount}
							</Text>
						</>
					) : null}
				</>
			)}
		</View>
	);
}

function FindingRow({
	finding,
	rankByPrevalence,
	onPress
}: {
	finding: VulnerabilityRiskFinding;
	rankByPrevalence: boolean;
	onPress: () => void;
}) {
	const trailing = findingValue(finding, rankByPrevalence);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 10,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<SeverityBadge severity={severityFromRaw(finding.severity.toUpperCase())} />
			<View style={{ flex: 1, gap: 4 }}>
				<Text style={[m3Type.titleSmall, { color: colors.label }]}>{finding.vulnerabilityId}</Text>
				<Text
					numberOfLines={1}
					style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontFamily: monoFamily }]}
				>
					{`${finding.pkgName} → ${finding.fixedVersion ?? 'No fix'}`}
				</Text>
				<Text
					style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}
				>{`${finding.imagesAffected} images`}</Text>
			</View>
			<View style={{ alignItems: 'flex-end', gap: 2 }}>
				<Text style={[m3Type.titleMedium, tabular, { color: colors.label }]}>{trailing.value}</Text>
				<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
					{trailing.caption}
				</Text>
			</View>
		</Pressable>
	);
}

function ImageRow({ image, onPress }: { image: VulnerabilityRiskImage; onPress: () => void }) {
	const unavailable = image.scoreStatus === 'unavailable';
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<View style={{ flex: 1, gap: 4 }}>
				<Text numberOfLines={1} style={[m3Type.titleSmall, { color: colors.label }]}>
					{image.imageName}
				</Text>
				<Text
					style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
				>{`${capitalized(image.exposure)} · ${image.findings} findings`}</Text>
			</View>
			<Text
				style={[
					m3Type.titleMedium,
					tabular,
					{ color: unavailable ? colors.secondaryLabel : riskBandColor(image.riskBand) }
				]}
			>
				{unavailable ? '–' : String(image.riskScore)}
			</Text>
			<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
		</Pressable>
	);
}

function ScoreCard({
	overview,
	memoryKey,
	selectVulnerability
}: {
	overview: VulnerabilityRiskOverview;
	memoryKey: string;
	selectVulnerability: (id: string) => void;
}) {
	const p = overviewPresentation(overview);
	const driver = overview.scoreDriver;
	return (
		<View style={{ alignItems: 'center', gap: 16, paddingVertical: 12 }}>
			<Text style={[m3Type.titleMedium, { color: colors.label, alignSelf: 'stretch' }]}>
				Patch priority
			</Text>
			<View accessible accessibilityLabel={p.accessibility}>
				<RiskScoreRing
					target={p.scoreTarget}
					unavailable={p.scoreUnavailable}
					color={p.scoreColor}
					memoryKey={memoryKey}
				/>
			</View>
			<Text style={[m3Type.titleSmall, { color: p.scoreColor ?? colors.secondaryLabel }]}>
				{p.bandLabel}
			</Text>
			{driver ? (
				<Pressable
					onPress={() => selectVulnerability(driver.vulnerabilityId)}
					accessibilityRole="button"
					android_ripple={{ color: colors.separator as string }}
					style={{ alignSelf: 'stretch', alignItems: 'center', gap: 4, paddingVertical: 4 }}
				>
					<Text
						style={[m3Type.titleSmall, { color: colors.label }]}
					>{`Top fix: ${driver.vulnerabilityId}`}</Text>
					<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.label }]}>
						{driver.imageName}
					</Text>
					<Text
						numberOfLines={1}
						style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontFamily: monoFamily }]}
					>
						{`${driver.pkgName} → ${driver.fixedVersion}`}
					</Text>
				</Pressable>
			) : null}
			<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel, textAlign: 'center' }]}>
				Higher scores mean more urgent fixes. Image use and known exploitation affect the score.
			</Text>
		</View>
	);
}

function TrendCard({
	overview,
	trendDays,
	setTrendDays
}: {
	overview: VulnerabilityRiskOverview;
	trendDays: number;
	setTrendDays: (days: number) => void;
}) {
	const p = overviewPresentation(overview);
	const points = trendPoints(overview, trendDays);
	const delta = overview.delta7d !== undefined ? deltaPresentation(overview.delta7d) : undefined;
	return (
		<View style={{ gap: 12, paddingVertical: 4 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
					{delta ? (
						<>
							<Icon
								name={delta.systemImage}
								size={14}
								color={delta.color ?? colors.secondaryLabel}
							/>
							<Text style={[m3Type.bodySmall, { color: delta.color ?? colors.secondaryLabel }]}>
								{delta.title}
							</Text>
						</>
					) : null}
				</View>
				<MaterialSegmentedButtons
					options={TrendRanges}
					selection={trendDays as (typeof TrendRanges)[number]['value']}
					onSelect={setTrendDays}
					style={{ alignSelf: 'auto', width: 160 }}
				/>
			</View>
			{points.length > 1 ? (
				<>
					<RiskTrendChart
						values={points.map((point) => point.riskScore)}
						color={p.scoreColor ?? systemColors.gray}
					/>
					<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
						<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
							{points[0]?.date ?? ''}
						</Text>
						<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
							{points[points.length - 1]?.date ?? ''}
						</Text>
					</View>
				</>
			) : (
				<View style={{ minHeight: 100, alignItems: 'center', justifyContent: 'center' }}>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						Trend appears after another daily snapshot.
					</Text>
				</View>
			)}
		</View>
	);
}

export function SecurityOverview({
	overview,
	selectVulnerability,
	openImage
}: SecurityOverviewProps) {
	const [selectedRiskPanel, setSelectedRiskPanel] = useState<RiskPanel>('score');
	const [trendDays, setTrendDays] = useState(30);
	const [rankByPrevalence, setRankByPrevalence] = useState(false);
	const [memoryKey] = useState(() => `overview-${++overviewCounter}`);
	useEffect(() => () => releaseRiskScoreMemory(memoryKey), [memoryKey]);
	const p = overviewPresentation(overview);
	const { drivers, drivers7dAgo, exposure, summary } = overview;

	if (drivers.imagesScanned === 0) {
		return (
			<View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
				<Icon name="shield.lefthalf.filled" size={44} color={colors.secondaryLabel} />
				<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>
					No scans yet
				</Text>
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
					Scan an image to see the security overview.
				</Text>
			</View>
		);
	}

	const findings = rankByPrevalence ? overview.prevalentFindings : overview.riskiestFindings;

	return (
		<>
			<M3Section title="Risk">
				<View style={{ padding: 16, gap: 16 }}>
					<MaterialSegmentedButtons
						options={RiskPanels}
						selection={selectedRiskPanel}
						onSelect={setSelectedRiskPanel}
					/>
					{selectedRiskPanel === 'score' ? (
						<ScoreCard
							overview={overview}
							memoryKey={memoryKey}
							selectVulnerability={selectVulnerability}
						/>
					) : (
						<TrendCard overview={overview} trendDays={trendDays} setTrendDays={setTrendDays} />
					)}
				</View>
			</M3Section>

			<M3Section title="Findings by severity">
				<View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
					<SeverityBar
						critical={summary.critical}
						high={summary.high}
						medium={summary.medium}
						low={summary.low}
						unknown={summary.unknown}
					/>
				</View>
			</M3Section>

			<M3Section title="Exposure">
				<ExposureRow label="Running" count={exposure.running} color={systemColors.orange} />
				<ExposureRow label="Stopped" count={exposure.stopped} color={systemColors.yellow} />
				<ExposureRow
					label="Unused"
					count={exposure.unused}
					color={colors.secondaryLabel as string}
				/>
				{exposure.unknown > 0 ? (
					<ExposureRow
						label="Unknown"
						count={exposure.unknown}
						color={colors.secondaryLabel as string}
					/>
				) : null}
			</M3Section>

			<M3Section title="Risk drivers" footer={p.driversFooter}>
				<DriverRow
					label="Known exploited"
					count={drivers.knownExploited}
					previous={drivers7dAgo?.knownExploited}
					unavailable={!p.threatDataAvailable}
				/>
				<DriverRow
					label="High exploit probability"
					count={drivers.highEpss}
					previous={drivers7dAgo?.highEpss}
					unavailable={!p.threatDataAvailable}
				/>
				<DriverRow
					label="Exposed critical and high"
					count={drivers.exposedCriticalHigh}
					previous={drivers7dAgo?.exposedCriticalHigh}
					unavailable={false}
				/>
				<DriverRow
					label="Overdue known exploited"
					count={drivers.overdueKnownExploited}
					previous={drivers7dAgo?.overdueKnownExploited}
					unavailable={!p.threatDataAvailable}
				/>
				<View style={rowStyle}>
					<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>Images scanned</Text>
					<Text
						style={[m3Type.bodyLarge, tabular, { color: colors.secondaryLabel }]}
					>{`${drivers.imagesScanned} / ${drivers.imagesTotal}`}</Text>
				</View>
			</M3Section>

			<M3Section
				title="Priority findings"
				footer="Select a finding to see its affected images and package details."
			>
				<View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
					<MaterialSegmentedButtons
						options={[
							{ value: 'risk', title: 'Risk' },
							{ value: 'prevalence', title: 'Prevalence' }
						]}
						selection={rankByPrevalence ? 'prevalence' : 'risk'}
						onSelect={(value) => setRankByPrevalence(value === 'prevalence')}
					/>
				</View>
				{findings.map((finding) => (
					<FindingRow
						key={finding.vulnerabilityId}
						finding={finding}
						rankByPrevalence={rankByPrevalence}
						onPress={() => selectVulnerability(finding.vulnerabilityId)}
					/>
				))}
			</M3Section>

			{overview.riskiestImages.length > 0 ? (
				<M3Section title="Riskiest images">
					{overview.riskiestImages.map((image) => (
						<ImageRow
							key={image.imageId}
							image={image}
							onPress={() => openImage(image.imageId, image.imageName)}
						/>
					))}
				</M3Section>
			) : null}
		</>
	);
}
