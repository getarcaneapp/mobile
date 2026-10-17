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

export function formatDate(date: Date, dateStyle: DateStyle, timeStyle: TimeStyle): string {
	return date.toLocaleString(undefined, { ...dateOptions[dateStyle], ...timeOptions[timeStyle] });
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
	return date ? date.toLocaleTimeString(undefined, timeOptions.standard) : undefined;
}
