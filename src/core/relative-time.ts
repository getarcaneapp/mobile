/**
 * `Intl.RelativeTimeFormat(locale, { numeric: "auto" })`, which Hermes on iOS
 * doesn't ship: `new Intl.RelativeTimeFormat` throws there. Uses the real
 * formatter when present, else an English fallback with the same output.
 */
type Unit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export type RelativeTimeFormatter = { format: (value: number, unit: Unit) => string };

/** `numeric: "auto"` names for -1, 0, +1. */
const named: Record<Unit, [string, string, string]> = {
	second: ['', 'now', ''],
	minute: ['', 'this minute', ''],
	hour: ['', 'this hour', ''],
	day: ['yesterday', 'today', 'tomorrow'],
	week: ['last week', 'this week', 'next week'],
	month: ['last month', 'this month', 'next month'],
	quarter: ['last quarter', 'this quarter', 'next quarter'],
	year: ['last year', 'this year', 'next year']
};

const englishFallback: RelativeTimeFormatter = {
	format(value, unit) {
		const whole = Math.trunc(value);
		if (whole === 0 || Object.is(whole, -0)) return named[unit][1];
		if (whole === -1 && named[unit][0]) return named[unit][0];
		if (whole === 1 && named[unit][2]) return named[unit][2];
		const count = Math.abs(whole);
		const label = `${count} ${unit}${count === 1 ? '' : 's'}`;
		return whole < 0 ? `${label} ago` : `in ${label}`;
	}
};

let cached: RelativeTimeFormatter | undefined;

export function relativeTimeFormat(): RelativeTimeFormatter {
	if (cached) return cached;
	try {
		cached = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	} catch {
		cached = englishFallback;
	}
	return cached;
}
