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
		if (parts.length === 6) parts.shift();
		if (parts.length !== 5) return undefined;

		const [minute = '', hour = '', day = '', month = '', weekday = ''] = parts;

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
		const h = swiftInt(hour);
		if (minute === '0' && h !== undefined && day === '*' && month === '*' && weekday === '*') {
			return `Daily at ${formatHour(h)}:00`;
		}
		return undefined;
	}
} as const;
