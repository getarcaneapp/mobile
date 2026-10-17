import assert from 'node:assert/strict';
import { describe, it, vi } from 'vite-plus/test';

import type { VulnerabilityRiskOverview } from '../../../sdk/types/VulnerabilityRiskOverview';
import { segmentWidth, severitySegments } from '../severity-bar.types';

vi.mock('@/theme/colors', () => ({
	systemColors: { red: 'red', orange: 'orange', yellow: 'yellow', blue: 'blue', gray: 'gray' }
}));

const payload = `{
  "riskScore": 70,
  "riskBand": "high",
  "scoreStatus": "ok",
  "summary": { "critical": 52, "high": 1089, "medium": 3660, "low": 626, "unknown": 209, "total": 5636 },
  "exposure": { "running": 5636, "stopped": 0, "unused": 0, "unknown": 0 }
}`;

describe('severitySegments', () => {
	const { summary } = JSON.parse(payload) as VulnerabilityRiskOverview;
	const result = severitySegments(summary);

	it('keeps every severity, in SeverityBar.swift order, labels and colors', () => {
		assert.deepEqual(
			result.segments.map((segment) => [segment.label, segment.count, segment.color]),
			[
				['Critical', 52, 'red'],
				['High', 1089, 'orange'],
				['Med', 3660, 'yellow'],
				['Low', 626, 'blue'],
				['?', 209, 'gray']
			]
		);
	});

	it("totals the segments to the summary's total", () => {
		assert.equal(result.total, summary.total);
		assert.equal(result.total, 5636);
	});

	it('describes every non-empty severity for VoiceOver', () => {
		assert.equal(
			result.summary,
			'Vulnerabilities: 52 Critical, 1089 High, 3660 Med, 626 Low, 209 ?'
		);
	});

	it('gives each visible segment a proportional width of at least 6pt', () => {
		const width = 338;
		const widths = result.segments.map((segment) =>
			segmentWidth(segment.count, result.total, width)
		);
		assert.equal(widths[0], 6);
		assert.ok(Math.abs((widths[2] ?? 0) - (width * 3660) / 5636) < 1e-9);
		assert.ok(widths.every((w) => w < width));
	});

	it('clamps negative and non-finite counts to zero', () => {
		const clamped = severitySegments({
			critical: -3,
			high: Number.NaN,
			medium: 2.7,
			low: Infinity,
			unknown: 0
		});
		assert.deepEqual(
			clamped.segments.map((segment) => segment.count),
			[0, 0, 2, 0, 0]
		);
		assert.equal(clamped.total, 2);
	});

	it('reads an empty summary as no vulnerabilities', () => {
		const empty = severitySegments({ critical: 0, high: 0, medium: 0, low: 0, unknown: 0 });
		assert.equal(empty.total, 0);
		assert.equal(empty.summary, 'No vulnerabilities');
	});
});
