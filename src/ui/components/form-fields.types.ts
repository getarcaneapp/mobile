/**
 * Shared props for the form rows (FormFieldRows.swift).
 *
 * `FormFieldLayout`:
 * - `inline`: Settings style — title left, value right-aligned on one row.
 * - `stacked`: caption title above a full-width field, for long values.
 * - `automatic`: stacked for vertical / multi-line / URL fields, inline otherwise.
 */
export type FormFieldLayout = 'automatic' | 'inline' | 'stacked';

export type FormKeyboardType =
	| 'default'
	| 'email-address'
	| 'numeric'
	| 'phone-pad'
	| 'url'
	| 'decimal-pad'
	| 'ascii-capable'
	| 'numbers-and-punctuation';

export type FormAutocapitalization = 'never' | 'words' | 'sentences' | 'characters';

export type FormTextFieldProps = {
	title: string;
	placeholder: string;
	text: string;
	onChangeText: (text: string) => void;
	keyboardType?: FormKeyboardType;
	/** SwiftUI `UITextContentType` raw name, e.g. "URL", "username", "password". */
	textContentType?:
		| 'URL'
		| 'username'
		| 'password'
		| 'newPassword'
		| 'emailAddress'
		| 'oneTimeCode'
		| 'name';
	autocapitalization?: FormAutocapitalization;
	autocorrectionDisabled?: boolean;
	axis?: 'horizontal' | 'vertical';
	lineLimit?: { min: number; max: number };
	monospaced?: boolean;
	helper?: string;
	disabled?: boolean;
	layout?: FormFieldLayout;
};

export function resolvedLayout({
	layout = 'automatic',
	axis = 'horizontal',
	lineLimit,
	keyboardType
}: FormTextFieldProps): 'inline' | 'stacked' {
	if (layout !== 'automatic') return layout;
	return axis === 'vertical' || lineLimit !== undefined || keyboardType === 'url'
		? 'stacked'
		: 'inline';
}

export type FormSecureFieldProps = {
	title: string;
	placeholder: string;
	text: string;
	onChangeText: (text: string) => void;
	textContentType?: 'password' | 'newPassword' | 'oneTimeCode';
	helper?: string;
	disabled?: boolean;
};

export type FormNumberFieldProps = {
	title: string;
	placeholder: string;
	/** String-backed to match the flat settings store. */
	text: string;
	onChangeText: (text: string) => void;
	/** Floor for the stepper; defaults to 0 (these settings are all non-negative). */
	minValue?: number;
	maxValue?: number;
	step?: number;
	helper?: string;
	disabled?: boolean;
};

export function numberFieldValue(text: string, minValue?: number) {
	const parsed = parseInt(text.trim(), 10);
	return Number.isNaN(parsed) ? (minValue ?? 0) : parsed;
}

export function adjustNumber(text: string, delta: number, minValue?: number, maxValue?: number) {
	let next = Math.max(numberFieldValue(text, minValue) + delta, minValue ?? 0);
	if (maxValue !== undefined) next = Math.min(next, maxValue);
	return String(next);
}

export type FormValueRowProps = {
	title: string;
	value: string;
	helper?: string;
	monospaced?: boolean;
};

export type FormPickerOption<Value extends string | number> = { label: string; value: Value };

export type FormPickerProps<Value extends string | number> = {
	title: string;
	selection: Value;
	onSelectionChange: (value: Value) => void;
	options: FormPickerOption<Value>[];
	helper?: string;
};
