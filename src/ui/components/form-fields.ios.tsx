import {
	LabeledContent,
	Picker,
	SecureField,
	Stepper,
	Text,
	TextField,
	VStack,
	HStack,
	useNativeState
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled as autocorrectionDisabledModifier,
	disabled as disabledModifier,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	keyboardType as keyboardTypeModifier,
	labelsHidden,
	lineLimit as lineLimitModifier,
	multilineTextAlignment,
	padding,
	pickerStyle,
	tag,
	textContentType as textContentTypeModifier,
	textInputAutocapitalization,
	textSelection,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';

import {
	adjustNumber,
	numberFieldValue,
	resolvedLayout,
	type FormNumberFieldProps,
	type FormPickerProps,
	type FormSecureFieldProps,
	type FormTextFieldProps,
	type FormValueRowProps
} from './form-fields.types';

function useSyncedText(text: string) {
	const state = useNativeState(text);
	useEffect(() => {
		if (state.get() !== text) state.set(text);
	}, [state, text]);
	return state;
}

function HelperCaption({ helper }: { helper?: string }) {
	if (!helper) return null;
	return (
		<Text
			modifiers={[
				font({ textStyle: 'caption' }),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				frame({ maxWidth: Infinity, alignment: 'leading' })
			]}
		>
			{helper}
		</Text>
	);
}

const bodyFont = (monospaced?: boolean) =>
	font({ textStyle: 'body', design: monospaced ? 'monospaced' : 'default' });

export function FormTextField(props: FormTextFieldProps) {
	const {
		title,
		placeholder,
		text,
		onChangeText,
		keyboardType = 'default',
		textContentType,
		autocapitalization = 'sentences',
		autocorrectionDisabled = false,
		axis = 'horizontal',
		lineLimit,
		monospaced,
		helper,
		disabled = false
	} = props;
	const state = useSyncedText(text);
	const valueColor = disabled ? 'secondary' : 'primary';
	const inputModifiers: ModifierConfig[] = [
		foregroundStyle(valueColor),
		keyboardTypeModifier(keyboardType),
		...(textContentType ? [textContentTypeModifier(textContentType)] : []),
		textInputAutocapitalization(autocapitalization),
		autocorrectionDisabledModifier(autocorrectionDisabled),
		bodyFont(monospaced),
		disabledModifier(disabled)
	];

	if (resolvedLayout(props) === 'inline') {
		return (
			<VStack alignment="trailing" spacing={4}>
				<LabeledContent label={title}>
					<TextField
						text={state}
						placeholder={placeholder}
						onTextChange={onChangeText}
						modifiers={[multilineTextAlignment('trailing'), ...inputModifiers]}
					/>
				</LabeledContent>
				<HelperCaption helper={helper} />
			</VStack>
		);
	}
	return (
		<VStack alignment="leading" spacing={6} modifiers={[padding({ vertical: 3 })]}>
			<Text
				modifiers={[
					font({ textStyle: 'caption', weight: 'semibold' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{title}
			</Text>
			<TextField
				text={state}
				placeholder={placeholder}
				axis={axis}
				onTextChange={onChangeText}
				modifiers={[...inputModifiers, ...(lineLimit ? [lineLimitModifier(lineLimit)] : [])]}
			/>
			<HelperCaption helper={helper} />
		</VStack>
	);
}

export function FormSecureField({
	title,
	placeholder,
	text,
	onChangeText,
	textContentType,
	helper,
	disabled = false
}: FormSecureFieldProps) {
	const state = useSyncedText(text);
	return (
		<VStack alignment="trailing" spacing={4}>
			<LabeledContent label={title}>
				<SecureField
					text={state}
					placeholder={placeholder}
					onTextChange={onChangeText}
					modifiers={[
						multilineTextAlignment('trailing'),
						foregroundStyle(disabled ? 'secondary' : 'primary'),
						...(textContentType ? [textContentTypeModifier(textContentType)] : []),
						disabledModifier(disabled)
					]}
				/>
			</LabeledContent>
			<HelperCaption helper={helper} />
		</VStack>
	);
}

export function FormNumberField({
	title,
	placeholder,
	text,
	onChangeText,
	minValue,
	maxValue,
	step = 1,
	helper,
	disabled = false
}: FormNumberFieldProps) {
	const state = useSyncedText(text);
	return (
		<VStack alignment="trailing" spacing={4}>
			<LabeledContent label={title}>
				<HStack spacing={8}>
					<TextField
						text={state}
						placeholder={placeholder}
						onTextChange={onChangeText}
						modifiers={[
							multilineTextAlignment('trailing'),
							keyboardTypeModifier('numeric'),
							foregroundStyle(disabled ? 'secondary' : 'primary'),
							disabledModifier(disabled)
						]}
					/>
					<Stepper
						label={title}
						value={numberFieldValue(text, minValue)}
						step={step}
						min={minValue ?? 0}
						max={maxValue}
						onValueChange={(value) => {
							const delta = value - numberFieldValue(text, minValue);
							onChangeText(adjustNumber(text, delta, minValue, maxValue));
						}}
						modifiers={[labelsHidden(), fixedSize(), disabledModifier(disabled)]}
					/>
				</HStack>
			</LabeledContent>
			<HelperCaption helper={helper} />
		</VStack>
	);
}

export function FormValueRow({ title, value, helper, monospaced }: FormValueRowProps) {
	return (
		<VStack alignment="trailing" spacing={4}>
			<LabeledContent label={title}>
				<Text
					modifiers={[
						bodyFont(monospaced),
						multilineTextAlignment('trailing'),
						textSelection(true)
					]}
				>
					{value}
				</Text>
			</LabeledContent>
			<HelperCaption helper={helper} />
		</VStack>
	);
}

export function FormPicker<Value extends string | number>({
	title,
	selection,
	onSelectionChange,
	options,
	helper
}: FormPickerProps<Value>) {
	const picker = (
		<Picker
			label={title}
			selection={selection}
			onSelectionChange={onSelectionChange}
			modifiers={[pickerStyle('menu')]}
		>
			{options.map((option) => (
				<Text key={String(option.value)} modifiers={[tag(option.value)]}>
					{option.label}
				</Text>
			))}
		</Picker>
	);
	if (!helper) return picker;
	return (
		<VStack alignment="leading" spacing={4}>
			{picker}
			<HelperCaption helper={helper} />
		</VStack>
	);
}
