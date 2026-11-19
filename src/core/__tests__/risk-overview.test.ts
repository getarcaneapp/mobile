import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { mergeRiskOverviews } from '@/features/dashboard/dashboard-overview-logic';
import type {
	VulnerabilityRiskDrivers,
	VulnerabilityRiskOverview
} from '@/sdk/types/VulnerabilityRiskOverview';

const drivers = (knownExploited: number): VulnerabilityRiskDrivers => ({
	knownExploited,
	overdueKnownExploited: 0,
	highEpss: 0,
	exposedCriticalHigh: 0,
	fixable: 0,
	findings: knownExploited,
	imagesScanned: 1,
	imagesTotal: 1,
	scoredImages: 1
});

const overview = (
	riskScore: number,
	knownExploited: number,
	id: string
): VulnerabilityRiskOverview => ({
	riskScore,
	riskBand: riskScore > 50 ? 'high' : 'low',
	scoreStatus: 'ok',
	trend: [],
	drivers: drivers(knownExploited),
	summary: {
		critical: knownExploited,
		high: 0,
		medium: 0,
		low: 0,
		unknown: 0,
		total: knownExploited
	},
	exposure: { running: 1, stopped: 0, unused: 0, unknown: 0 },
	riskiestImages: [],
	riskiestFindings: [
		{
			vulnerabilityId: id,
			pkgName: 'pkg',
			severity: 'critical',
			cvss: 9,
			risk: riskScore,
			knownExploited: true,
			ransomware: false,
			imagesAffected: 1
		}
	],
	prevalentFindings: [],
	threatIntel: { enabled: true, stale: false }
});

describe('risk overview merging', () => {
	it('returns a single overview unchanged', () => {
		const only = overview(10, 1, 'a');
		assert.equal(mergeRiskOverviews([only]), only);
		assert.equal(mergeRiskOverviews([]), undefined);
	});

	it('combines counts across batches and keeps the riskiest headline', () => {
		const merged = mergeRiskOverviews([overview(20, 1, 'a'), overview(80, 3, 'b')]);
		assert.equal(merged?.riskScore, 80);
		assert.equal(merged?.riskBand, 'high');
		assert.equal(merged?.drivers.knownExploited, 4);
		assert.equal(merged?.summary.total, 4);
		assert.equal(merged?.exposure.running, 2);
		assert.deepEqual(
			merged?.riskiestFindings.map((finding) => finding.vulnerabilityId),
			['b']
		);
	});
});
