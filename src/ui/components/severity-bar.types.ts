import { systemColors } from '@/theme/colors';

export type SeverityBarProps = {
	critical: number;
	high: number;
	medium: number;
	low: number;
	unknown: number;
};

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

export const segmentGap = 2;
const minimumSegmentWidth = 6;

export function segmentWidths(counts: number[], width: number, gap = segmentGap) {
	const visible = counts.filter((count) => count > 0);
	if (visible.length === 0 || width <= 0) return [];
	const available = Math.max(0, width - gap * (visible.length - 1));
	if (available <= minimumSegmentWidth * visible.length) {
		return visible.map(() => available / visible.length);
	}
	const pinned = new Set<number>();
	let widths = visible.map(() => 0);
	let changed = true;
	while (changed) {
		changed = false;
		const free = available - pinned.size * minimumSegmentWidth;
		const freeTotal = visible.reduce((sum, count, i) => (pinned.has(i) ? sum : sum + count), 0);
		widths = visible.map((count, i) =>
			pinned.has(i) ? minimumSegmentWidth : (free * count) / freeTotal
		);
		widths.forEach((w, i) => {
			if (!pinned.has(i) && w < minimumSegmentWidth) {
				pinned.add(i);
				changed = true;
			}
		});
	}
	return widths;
}
