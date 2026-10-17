export type ISODateString = string;

const ISO_PATTERN =
	/^(\d{4}-\d{2}-\d{2})[Tt](\d{2}:\d{2}:\d{2})(?:\.(\d+))?([Zz]|[+-]\d{2}:?\d{2})$/;

export function parseArcaneDate(value: string | undefined | null): Date | undefined {
	if (value == null) return undefined;
	const match = ISO_PATTERN.exec(value.trim());
	if (!match) return undefined;
	const [, day, time, fraction, zone] = match;
	const millis = fraction ? `.${fraction.slice(0, 3).padEnd(3, '0')}` : '';
	const normalizedZone =
		zone === undefined || zone === 'z' || zone === 'Z'
			? 'Z'
			: zone.includes(':')
				? zone
				: `${zone.slice(0, 3)}:${zone.slice(3)}`;
	const parsed = Date.parse(`${day}T${time}${millis}${normalizedZone}`);
	return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

export function requireArcaneDate(value: string): Date {
	const date = parseArcaneDate(value);
	if (!date) throw new Error(`Invalid ISO8601 date: ${value}`);
	return date;
}

export function formatArcaneDate(date: Date): ISODateString {
	return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function timeIntervalSinceNow(value: ISODateString, now: number = Date.now()): number {
	const date = parseArcaneDate(value);
	return date ? (date.getTime() - now) / 1000 : Number.NEGATIVE_INFINITY;
}
