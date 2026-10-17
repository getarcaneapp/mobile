import type {
	VulnerabilityRiskFinding,
	VulnerabilityRiskOverview
} from '@/sdk/types/VulnerabilityRiskOverview';
import { systemColors } from '@/theme/colors';

import { capitalized, riskBandColor } from './vulnerability-model';

export type RiskPanel = 'score' | 'trend';

export const RiskPanels: { value: RiskPanel; title: string }[] = [
	{ value: 'score', title: 'Score' },
	{ value: 'trend', title: 'Trend' }
];

export const TrendRanges = [
	{ value: 30, title: '30d' },
	{ value: 90, title: '90d' }
] as const;

export function overviewPresentation(overview: VulnerabilityRiskOverview) {
	const scoreUnavailable = overview.scoreStatus === 'unavailable';
	const scoreTarget = scoreUnavailable ? 0 : Math.min(Math.max(overview.riskScore, 0), 100);
	const scoreColor = scoreUnavailable ? undefined : riskBandColor(overview.riskBand);
	const bandLabel = scoreUnavailable ? 'Unavailable' : capitalized(overview.riskBand);
	const threatDataAvailable =
		overview.threatIntel.enabled && overview.threatIntel.lastSyncedAt !== undefined;
	const accessibility = scoreUnavailable
		? 'Patch priority unavailable'
		: `Patch priority ${overview.riskScore} out of 100, ${bandLabel}`;

	let driversFooter: string | undefined;
	if (!overview.threatIntel.enabled) {
		driversFooter =
			'Threat intelligence is disabled. Known exploited and exploit probability counts are unavailable.';
	} else if (overview.threatIntel.lastSyncedAt === undefined) {
		driversFooter = 'Threat intelligence has not synced yet.';
	} else if (overview.threatIntel.stale) {
		driversFooter = 'Threat intelligence is out of date.';
	}

	return {
		scoreUnavailable,
		scoreTarget,
		scoreColor,
		bandLabel,
		threatDataAvailable,
		accessibility,
		driversFooter
	};
}

export function deltaPresentation(delta: number) {
	return {
		title: delta === 0 ? 'No change in 7 days' : `${Math.abs(delta)} in 7 days`,
		systemImage: delta > 0 ? 'arrow.up.right' : delta < 0 ? 'arrow.down.right' : 'minus',
		color: delta > 0 ? systemColors.orange : undefined
	};
}

export const trendPoints = (overview: VulnerabilityRiskOverview, days: number) =>
	overview.trend.slice(-days);

export function driverChange(count: number, previous: number | undefined) {
	if (previous === undefined || count === previous) return undefined;
	return {
		systemImage: count > previous ? 'arrow.up.right' : 'arrow.down.right',
		color: count > previous ? systemColors.orange : systemColors.green,
		amount: String(Math.abs(count - previous))
	};
}

export function findingValue(finding: VulnerabilityRiskFinding, rankByPrevalence: boolean) {
	return {
		value: String(rankByPrevalence ? finding.imagesAffected : Math.round(finding.risk * 10)),
		caption: rankByPrevalence ? 'images' : 'risk'
	};
}
