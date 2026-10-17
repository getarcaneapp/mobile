/** Formatting shared by the Variables screens. Pure TS. */

/** `Text(date, style: .relative)`: the two largest units, e.g. "2 hours, 5 minutes". */
export function relativeDuration(date: Date, now = Date.now()): string {
	const total = Math.floor(Math.abs(now - date.getTime()) / 1000);
	const units: [string, number][] = [
		['day', 86_400],
		['hour', 3_600],
		['minute', 60],
		['second', 1]
	];
	const format = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;
	const first = units.findIndex(([, size]) => total >= size);
	if (first < 0) return format(0, 'second');
	const [unit, size] = units[first] ?? ['second', 1];
	const parts = [format(Math.floor(total / size), unit)];
	const next = units[first + 1];
	if (next) {
		const remainder = Math.floor((total % size) / next[1]);
		if (remainder > 0) parts.push(format(remainder, next[0]));
	}
	return parts.join(', ');
}

/** A secret's value is never shown. */
export const maskedSecret = '••••••••';
