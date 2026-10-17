import { systemColors } from '@/theme/colors';

export type SeverityBarProps = {
	critical: number;
	high: number;
	medium: number;
	low: number;
	unknown: number;
};

/** Segments in `SeverityBar` order, counts clamped to ≥ 0. */
export function severitySegments(props: SeverityBarProps) {
	const nonnegative = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0);
	const segments = [
		{ label: 'Critical', count: nonnegative(props.critical), color: systemColors.red },
		{ label: 'High', count: nonnegative(props.high), color: systemColors.orange },
		{ label: 'Med', count: nonnegative(props.medium), color: systemColors.yellow },
		{ label: 'Low', count: nonnegative(props.low), color: systemColors.blue },
		{ label: '?', count: nonnegative(props.unknown), color: systemColors.gray }
	];
	const total = Math.min(
		segments.reduce((sum, s) => sum + s.count, 0),
		Number.MAX_SAFE_INTEGER
	);
	const summary =
		total > 0
			? 'Vulnerabilities: ' +
				segments
					.filter((s) => s.count > 0)
					.map((s) => `${s.count} ${s.label}`)
					.join(', ')
			: 'No vulnerabilities';
	return { segments, total, summary };
}

/** Width of one segment in a bar `width` wide (each visible segment is at least 6pt). */
export const segmentWidth = (count: number, total: number, width: number) =>
	Math.max(6, (width * count) / total);
