/**
 * Port of `SecurityOverviewView` (SecurityOverviewView.swift): the risk
 * score / trend card, findings by severity, exposure, risk drivers, priority
 * findings, and riskiest images, as sections of the hosting List.
 *
 * SwiftUI-tree.
 */
import {
	Button,
	Circle,
	ContentUnavailableView,
	HStack,
	Label,
	LabeledContent,
	Picker,
	RNHostView,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityLabel,
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listRowBackground,
	monospacedDigit,
	multilineTextAlignment,
	padding,
	pickerStyle,
	shapes,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import type {
	VulnerabilityRiskFinding,
	VulnerabilityRiskImage,
	VulnerabilityRiskOverview
} from '@/sdk/types/VulnerabilityRiskOverview';
import { systemColors } from '@/theme/colors';
import { SeverityBar } from '@/ui/components/severity-bar';
import { DisclosureChevron } from '@/ui/settings-row';

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
	/** "Riskiest images" → ImageVulnerabilitiesView in the overview's environment. */
	openImage: (imageID: string, imageName: string) => void;
};

function ExposureRow({ label, count, color }: { label: string; count: number; color: string }) {
	return (
		<HStack modifiers={[accessibilityElement('combine')]}>
			<Circle modifiers={[foregroundStyle(color), frame({ width: 8, height: 8 })]} />
			<Text>{label}</Text>
			<Spacer />
			<Text
				modifiers={[
					monospacedDigit(),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{String(count)}
			</Text>
		</HStack>
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
		<HStack>
			<Text>{label}</Text>
			<Spacer />
			{unavailable ? (
				<Text
					modifiers={[
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						accessibilityLabel('Unavailable')
					]}
				>
					–
				</Text>
			) : (
				<>
					<Text modifiers={[monospacedDigit()]}>{String(count)}</Text>
					{change ? (
						<>
							<Image
								systemName={change.systemImage as SFSymbol}
								modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(change.color)]}
							/>
							<Text
								modifiers={[
									font({ textStyle: 'caption2' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{change.amount}
							</Text>
						</>
					) : null}
				</>
			)}
		</HStack>
	);
}

function FindingRow({
	finding,
	rankByPrevalence
}: {
	finding: VulnerabilityRiskFinding;
	rankByPrevalence: boolean;
}) {
	const trailing = findingValue(finding, rankByPrevalence);
	return (
		<HStack spacing={10} modifiers={[padding({ vertical: 3 }), contentShape(shapes.rectangle())]}>
			<SeverityBadge severity={severityFromRaw(finding.severity.toUpperCase())} />
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
					{finding.vulnerabilityId}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption', design: 'monospaced' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					{`${finding.pkgName} → ${finding.fixedVersion ?? 'No fix'}`}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>{`${finding.imagesAffected} images`}</Text>
			</VStack>
			<Spacer minLength={8} />
			<VStack alignment="trailing" spacing={2}>
				<Text modifiers={[font({ textStyle: 'headline' }), monospacedDigit()]}>
					{trailing.value}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{trailing.caption}
				</Text>
			</VStack>
		</HStack>
	);
}

function ImageRow({ image }: { image: VulnerabilityRiskImage }) {
	const unavailable = image.scoreStatus === 'unavailable';
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 3 })]}>
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'subheadline', weight: 'medium' }), lineLimit(1)]}>
					{image.imageName}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{`${capitalized(image.exposure)} · ${image.findings} findings`}
				</Text>
			</VStack>
			<Spacer minLength={8} />
			<Text
				modifiers={[
					font({ textStyle: 'headline' }),
					monospacedDigit(),
					foregroundStyle(unavailable ? 'secondary' : riskBandColor(image.riskBand))
				]}
			>
				{unavailable ? '–' : String(image.riskScore)}
			</Text>
		</HStack>
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
		<VStack spacing={16} modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 12 })]}>
			<Text
				modifiers={[
					font({ textStyle: 'headline' }),
					frame({ maxWidth: Infinity, alignment: 'leading' })
				]}
			>
				Patch priority
			</Text>
			<VStack
				modifiers={[
					frame({ width: 170, height: 170 }),
					accessibilityElement('ignore'),
					accessibilityLabel(p.accessibility)
				]}
			>
				{/* SwiftUI strokes the 170pt circle on its path, so the 14pt ring overflows the frame by 7pt per side. */}
				<RNHostView matchContents>
					<View style={{ width: 184, height: 184 }}>
						<RiskScoreRing
							target={p.scoreTarget}
							unavailable={p.scoreUnavailable}
							color={p.scoreColor}
							memoryKey={memoryKey}
							size={184}
						/>
					</View>
				</RNHostView>
			</VStack>
			<Text
				modifiers={[
					font({ textStyle: 'subheadline', weight: 'semibold' }),
					foregroundStyle(p.scoreColor ?? 'secondary')
				]}
			>
				{p.bandLabel}
			</Text>
			{driver ? (
				<Button
					onPress={() => selectVulnerability(driver.vulnerabilityId)}
					modifiers={[buttonStyle('plain')]}
				>
					<VStack spacing={4} modifiers={[frame({ maxWidth: Infinity })]}>
						<Text
							modifiers={[font({ textStyle: 'subheadline', weight: 'medium' })]}
						>{`Top fix: ${driver.vulnerabilityId}`}</Text>
						<Text modifiers={[font({ textStyle: 'caption' }), lineLimit(1)]}>
							{driver.imageName}
						</Text>
						<Text
							modifiers={[
								font({ textStyle: 'caption', design: 'monospaced' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
								lineLimit(1)
							]}
						>
							{`${driver.pkgName} → ${driver.fixedVersion}`}
						</Text>
					</VStack>
				</Button>
			) : null}
			<Text
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
					multilineTextAlignment('center')
				]}
			>
				Higher scores mean more urgent fixes. Image use and known exploitation affect the score.
			</Text>
		</VStack>
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
		<VStack alignment="leading" spacing={12} modifiers={[padding({ vertical: 4 })]}>
			<HStack>
				{delta ? (
					<Label
						title={delta.title}
						systemImage={delta.systemImage as SFSymbol}
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle(delta.color ?? 'secondary')
						]}
					/>
				) : null}
				<Spacer />
				<Picker
					label="Range"
					selection={trendDays}
					onSelectionChange={(value: number) => setTrendDays(value)}
					modifiers={[pickerStyle('segmented'), frame({ width: 130 })]}
				>
					{TrendRanges.map((range) => (
						<Text key={range.value} modifiers={[tag(range.value)]}>
							{range.title}
						</Text>
					))}
				</Picker>
			</HStack>
			{points.length > 1 ? (
				<>
					<HStack modifiers={[frame({ maxWidth: Infinity, minHeight: 130, maxHeight: 130 })]}>
						<RNHostView>
							<View style={{ flex: 1, height: 130 }}>
								<RiskTrendChart
									values={points.map((point) => point.riskScore)}
									color={p.scoreColor ?? systemColors.gray}
								/>
							</View>
						</RNHostView>
					</HStack>
					<HStack
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						<Text>{points[0]?.date ?? ''}</Text>
						<Spacer />
						<Text>{points[points.length - 1]?.date ?? ''}</Text>
					</HStack>
				</>
			) : (
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						frame({ maxWidth: Infinity, minHeight: 100 })
					]}
				>
					Trend appears after another daily snapshot.
				</Text>
			)}
		</VStack>
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
			<Section>
				<ContentUnavailableView
					title="No scans yet"
					systemImage="shield.lefthalf.filled"
					description="Scan an image to see the security overview."
					modifiers={[listRowBackground('clear')]}
				/>
			</Section>
		);
	}

	const findings = rankByPrevalence ? overview.prevalentFindings : overview.riskiestFindings;

	return (
		<>
			<Section title="Risk">
				<VStack spacing={16}>
					<Picker
						label="Risk view"
						selection={selectedRiskPanel}
						onSelectionChange={(value: RiskPanel) => setSelectedRiskPanel(value)}
						modifiers={[pickerStyle('segmented')]}
					>
						{RiskPanels.map((panel) => (
							<Text key={panel.value} modifiers={[tag(panel.value)]}>
								{panel.title}
							</Text>
						))}
					</Picker>
					{selectedRiskPanel === 'score' ? (
						<ScoreCard
							overview={overview}
							memoryKey={memoryKey}
							selectVulnerability={selectVulnerability}
						/>
					) : (
						<TrendCard overview={overview} trendDays={trendDays} setTrendDays={setTrendDays} />
					)}
				</VStack>
			</Section>

			<Section title="Findings by severity">
				<VStack modifiers={[padding({ vertical: 8 })]}>
					<SeverityBar
						critical={summary.critical}
						high={summary.high}
						medium={summary.medium}
						low={summary.low}
						unknown={summary.unknown}
					/>
				</VStack>
			</Section>

			<Section title="Exposure">
				<ExposureRow label="Running" count={exposure.running} color={systemColors.orange} />
				<ExposureRow label="Stopped" count={exposure.stopped} color={systemColors.yellow} />
				<ExposureRow label="Unused" count={exposure.unused} color="secondary" />
				{exposure.unknown > 0 ? (
					<ExposureRow label="Unknown" count={exposure.unknown} color="secondary" />
				) : null}
			</Section>

			<Section
				header={<Text>Risk drivers</Text>}
				footer={p.driversFooter ? <Text>{p.driversFooter}</Text> : undefined}
			>
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
				<LabeledContent label="Images scanned">
					<Text
						modifiers={[monospacedDigit()]}
					>{`${drivers.imagesScanned} / ${drivers.imagesTotal}`}</Text>
				</LabeledContent>
			</Section>

			<Section
				header={<Text>Priority findings</Text>}
				footer={<Text>Select a finding to see its affected images and package details.</Text>}
			>
				<Picker
					label="Rank by"
					selection={rankByPrevalence ? 'prevalence' : 'risk'}
					onSelectionChange={(value: string) => setRankByPrevalence(value === 'prevalence')}
					modifiers={[pickerStyle('segmented')]}
				>
					<Text modifiers={[tag('risk')]}>Risk</Text>
					<Text modifiers={[tag('prevalence')]}>Prevalence</Text>
				</Picker>
				{findings.map((finding) => (
					<Button
						key={finding.vulnerabilityId}
						onPress={() => selectVulnerability(finding.vulnerabilityId)}
						modifiers={[buttonStyle('plain')]}
					>
						<FindingRow finding={finding} rankByPrevalence={rankByPrevalence} />
					</Button>
				))}
			</Section>

			{overview.riskiestImages.length > 0 ? (
				<Section title="Riskiest images">
					{overview.riskiestImages.map((image) => (
						<Button
							key={image.imageId}
							onPress={() => openImage(image.imageId, image.imageName)}
							modifiers={[buttonStyle('plain')]}
						>
							<HStack modifiers={[contentShape(shapes.rectangle())]}>
								<ImageRow image={image} />
								<DisclosureChevron />
							</HStack>
						</Button>
					))}
				</Section>
			) : null}
		</>
	);
}
