/**
 * Android stand-in for a SwiftUI `DatePicker` row inside a Form: title left,
 * the formatted value right; tapping opens the Material 3 date dialog (then
 * the time dialog when `includesTime`). Standalone; Android only (Compose)
 * — import it from `.android.tsx` files.
 */
import { Host } from '@expo/ui';
import { DatePickerDialog, TimePickerDialog } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatDate } from '@/core/date-formatting';
import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';

export function DatePickerRow({
	title,
	value,
	onChange,
	minimumDate,
	includesTime = false,
	disabled = false
}: {
	title: string;
	value: Date;
	onChange: (date: Date) => void;
	minimumDate?: Date;
	includesTime?: boolean;
	disabled?: boolean;
}) {
	const [step, setStep] = useState<'closed' | 'date' | 'time'>('closed');
	const label = formatDate(value, 'abbreviated', includesTime ? 'shortened' : 'omitted');

	// The Material date picker reports the chosen day as UTC midnight; keep the current time of day.
	const pickDate = (picked: Date) => {
		const next = new Date(value);
		next.setFullYear(picked.getUTCFullYear(), picked.getUTCMonth(), picked.getUTCDate());
		onChange(next);
		setStep(includesTime ? 'time' : 'closed');
	};
	const pickTime = (picked: Date) => {
		const next = new Date(value);
		next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
		onChange(next);
		setStep('closed');
	};

	return (
		<View>
			<Pressable
				onPress={() => setStep('date')}
				disabled={disabled}
				accessibilityRole="button"
				accessibilityLabel={`${title}, ${label}`}
				android_ripple={{ color: colors.separator as string }}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 16,
					minHeight: 56,
					paddingHorizontal: 16,
					opacity: disabled ? 0.5 : 1
				}}
			>
				<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
				<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{label}</Text>
			</Pressable>
			{step === 'date' ? (
				<Host matchContents>
					<DatePickerDialog
						initialDate={value.toISOString()}
						selectableDates={minimumDate ? { start: minimumDate } : undefined}
						onDateSelected={pickDate}
						onDismissRequest={() => setStep('closed')}
					/>
				</Host>
			) : null}
			{step === 'time' ? (
				<Host matchContents>
					<TimePickerDialog
						initialDate={value.toISOString()}
						onDateSelected={pickTime}
						onDismissRequest={() => setStep('closed')}
					/>
				</Host>
			) : null}
		</View>
	);
}
