/**
 * Port of `CronExpression` (Views/Jobs/CronExpression.swift).
 *
 * Tiny best-effort cron-to-prose translator. Recognizes a handful of common
 * patterns (every N minutes/hours/days, daily at midnight, hourly on the hour)
 * and returns `undefined` for anything it can't confidently describe — the raw
 * cron expression is shown verbatim in those cases.
 */

/** Swift `Int(String)`: an optional sign followed by digits only. */
function swiftInt(value: string): number | undefined {
	return /^[+-]?\d+$/.test(value) ? parseInt(value, 10) : undefined;
}

function stepValue(field: string): number | undefined {
	if (!field.startsWith('*/')) return undefined;
	return swiftInt(field.slice(2));
}

function formatHour(hour: number): string {
	const clamped = Math.max(0, Math.min(23, hour));
	return String(clamped).padStart(2, '0');
}

export const CronExpression = {
	readable(expression: string): string | undefined {
		const parts = expression.split(' ').filter((part) => part !== '');
		if (parts.length === 0) return undefined;
		// Strip a leading seconds field so 6-field cron behaves like 5-field.
		if (parts.length === 6) parts.shift();
		if (parts.length !== 5) return undefined;

		const [minute = '', hour = '', day = '', month = '', weekday = ''] = parts;

		// Every N minutes
		const minuteStep = stepValue(minute);
		if (
			minuteStep !== undefined &&
			hour === '*' &&
			day === '*' &&
			month === '*' &&
			weekday === '*'
		) {
			return minuteStep === 1 ? 'Every minute' : `Every ${minuteStep} minutes`;
		}
		// Every N hours, on the hour
		const hourStep = stepValue(hour);
		if (
			minute === '0' &&
			hourStep !== undefined &&
			day === '*' &&
			month === '*' &&
			weekday === '*'
		) {
			return hourStep === 1 ? 'Every hour' : `Every ${hourStep} hours`;
		}
		// Every N days at midnight
		const dayStep = stepValue(day);
		if (
			minute === '0' &&
			hour === '0' &&
			dayStep !== undefined &&
			month === '*' &&
			weekday === '*'
		) {
			return dayStep === 1 ? 'Daily at midnight' : `Every ${dayStep} days at midnight`;
		}
		// Daily at HH:00
		const h = swiftInt(hour);
		if (minute === '0' && h !== undefined && day === '*' && month === '*' && weekday === '*') {
			return `Daily at ${formatHour(h)}:00`;
		}
		return undefined;
	}
} as const;
