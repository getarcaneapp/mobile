import { parseArcaneDate } from '@/sdk/models/base/date';

export type DateStyle = 'abbreviated' | 'numeric' | 'omitted';
export type TimeStyle = 'shortened' | 'standard' | 'omitted';

const dateOptions: Record<DateStyle, Intl.DateTimeFormatOptions> = {
	abbreviated: { month: 'short', day: 'numeric', year: 'numeric' },
	numeric: { month: 'numeric', day: 'numeric', year: 'numeric' },
	omitted: {}
};

const timeOptions: Record<TimeStyle, Intl.DateTimeFormatOptions> = {
	shortened: { hour: 'numeric', minute: '2-digit' },
	standard: { hour: 'numeric', minute: '2-digit', second: '2-digit' },
	omitted: {}
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(dateStyle: DateStyle, timeStyle: TimeStyle): Intl.DateTimeFormat {
	const key = `${dateStyle}|${timeStyle}`;
	let cached = formatters.get(key);
	if (!cached) {
		const options = { ...dateOptions[dateStyle], ...timeOptions[timeStyle] };
		cached = new Intl.DateTimeFormat(
			undefined,
			Object.keys(options).length === 0
				? {
						year: 'numeric',
						month: 'numeric',
						day: 'numeric',
						hour: 'numeric',
						minute: 'numeric',
						second: 'numeric'
					}
				: options
		);
		formatters.set(key, cached);
	}
	return cached;
}

export function formatDate(date: Date, dateStyle: DateStyle, timeStyle: TimeStyle): string {
	return formatter(dateStyle, timeStyle).format(date);
}

export function formattedISO8601(
	value: string,
	dateStyle: DateStyle,
	timeStyle: TimeStyle
): string {
	const date = parseArcaneDate(value);
	return date ? formatDate(date, dateStyle, timeStyle) : value;
}

export function formattedClockTime(value: string): string | undefined {
	const date = parseArcaneDate(value);
	return date ? formatter('omitted', 'standard').format(date) : undefined;
}

const shortDayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export function shortDayLabel(value: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (match) {
		const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
		return Number.isNaN(date.getTime()) ? value : shortDayFormatter.format(date);
	}
	const date = parseArcaneDate(value);
	return date ? shortDayFormatter.format(date) : value;
}
