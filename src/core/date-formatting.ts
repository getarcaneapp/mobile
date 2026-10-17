/**
 * Port of `ArcaneDateFormatting` (Utils/DateFormatting.swift) for the
 * `Date.FormatStyle` styles the app uses. Pure TS.
 */
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

/** `date.formatted(date:time:)`. */
export function formatDate(date: Date, dateStyle: DateStyle, timeStyle: TimeStyle): string {
	return date.toLocaleString(undefined, { ...dateOptions[dateStyle], ...timeOptions[timeStyle] });
}

/** Formats an ISO-8601 string, or returns it unchanged when it doesn't parse. */
export function formattedISO8601(
	value: string,
	dateStyle: DateStyle,
	timeStyle: TimeStyle
): string {
	const date = parseArcaneDate(value);
	return date ? formatDate(date, dateStyle, timeStyle) : value;
}

/** `.dateTime.hour().minute().second()`, or undefined when the value doesn't parse. */
export function formattedClockTime(value: string): string | undefined {
	const date = parseArcaneDate(value);
	return date ? date.toLocaleTimeString(undefined, timeOptions.standard) : undefined;
}
