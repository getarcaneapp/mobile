import { Host } from '@expo/ui';
import { DropdownMenu, DropdownMenuItem, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { useState, type ReactNode } from 'react';
import {
	Pressable,
	Text,
	TextInput,
	View,
	type KeyboardTypeOptions,
	type TextInputProps
} from 'react-native';

import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import {
	adjustNumber,
	resolvedLayout,
	type FormKeyboardType,
	type FormNumberFieldProps,
	type FormPickerProps,
	type FormSecureFieldProps,
	type FormTextFieldProps,
	type FormValueRowProps
} from './form-fields.types';
import { m3 } from './material-colors';
import { m3Type, monoFamily } from './type-scale';

const keyboard: Record<FormKeyboardType, KeyboardTypeOptions> = {
	default: 'default',
	'email-address': 'email-address',
	numeric: 'number-pad',
	'phone-pad': 'phone-pad',
	url: 'url',
	'decimal-pad': 'decimal-pad',
	'ascii-capable': 'ascii-capable',
	'numbers-and-punctuation': 'numbers-and-punctuation'
};

const autoComplete: Record<string, TextInputProps['autoComplete']> = {
	URL: 'url',
	username: 'username',
	password: 'password',
	newPassword: 'new-password',
	emailAddress: 'email',
	oneTimeCode: 'sms-otp',
	name: 'name'
};

function Helper({ helper }: { helper?: string }) {
	if (!helper) return null;
	return (
		<Text
			style={[
				m3Type.bodySmall,
				{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingBottom: 8 }
			]}
		>
			{helper}
		</Text>
	);
}

function InlineRow({ title, children }: { title: string; children: ReactNode }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				minHeight: 56,
				paddingHorizontal: 16,
				gap: 16
			}}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{title}</Text>
			<View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
		</View>
	);
}

export function FormTextField(props: FormTextFieldProps) {
	const {
		title,
		placeholder,
		text,
		onChangeText,
		keyboardType = 'default',
		textContentType,
		autocapitalization = 'sentences',
		autocorrectionDisabled,
		axis,
		lineLimit,
		monospaced,
		helper,
		disabled = false
	} = props;
	const common: TextInputProps = {
		value: text,
		onChangeText,
		placeholder,
		placeholderTextColor: colors.tertiaryLabel as string,
		keyboardType: keyboard[keyboardType],
		autoComplete: textContentType ? autoComplete[textContentType] : undefined,
		autoCapitalize: autocapitalization === 'never' ? 'none' : autocapitalization,
		autoCorrect: !autocorrectionDisabled,
		editable: !disabled
	};
	const fontStyle = [
		m3Type.bodyLarge,
		{ color: disabled ? colors.secondaryLabel : colors.label },
		monospaced && { fontFamily: monoFamily }
	];

	if (resolvedLayout(props) === 'inline') {
		return (
			<View>
				<InlineRow title={title}>
					<TextInput {...common} style={[fontStyle, { textAlign: 'right', minWidth: 120 }]} />
				</InlineRow>
				<Helper helper={helper} />
			</View>
		);
	}
	return (
		<View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 4 }}>
			<Text style={[m3Type.labelMedium, { color: colors.secondaryLabel }]}>{title}</Text>
			<TextInput
				{...common}
				multiline={axis === 'vertical' || lineLimit !== undefined}
				numberOfLines={lineLimit?.min}
				style={[
					fontStyle,
					{
						borderWidth: 1,
						borderColor: m3.outline,
						borderRadius: 4,
						paddingHorizontal: 16,
						paddingVertical: 12,
						minHeight: 56,
						textAlignVertical: 'top',
						maxHeight: lineLimit ? lineLimit.max * 24 + 24 : undefined
					}
				]}
			/>
			{helper ? (
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{helper}</Text>
			) : null}
		</View>
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
	return (
		<View>
			<InlineRow title={title}>
				<TextInput
					value={text}
					onChangeText={onChangeText}
					placeholder={placeholder}
					placeholderTextColor={colors.tertiaryLabel as string}
					secureTextEntry
					autoComplete={textContentType ? autoComplete[textContentType] : undefined}
					editable={!disabled}
					style={[
						m3Type.bodyLarge,
						{
							textAlign: 'right',
							minWidth: 120,
							color: disabled ? colors.secondaryLabel : colors.label
						}
					]}
				/>
			</InlineRow>
			<Helper helper={helper} />
		</View>
	);
}

function StepButton({
	icon,
	label,
	disabled,
	onPress
}: {
	icon: string;
	label: string;
	disabled: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
			style={{
				width: 40,
				height: 40,
				alignItems: 'center',
				justifyContent: 'center',
				opacity: disabled ? 0.38 : 1
			}}
		>
			<Icon name={icon} size={20} color={m3.onSurfaceVariant} />
		</Pressable>
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
	return (
		<View>
			<InlineRow title={title}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
					<TextInput
						value={text}
						onChangeText={onChangeText}
						placeholder={placeholder}
						placeholderTextColor={colors.tertiaryLabel as string}
						keyboardType="number-pad"
						editable={!disabled}
						style={[
							m3Type.bodyLarge,
							{
								textAlign: 'right',
								minWidth: 64,
								color: disabled ? colors.secondaryLabel : colors.label
							}
						]}
					/>
					<StepButton
						icon="minus"
						label={`Decrease ${title}`}
						disabled={disabled}
						onPress={() => onChangeText(adjustNumber(text, -step, minValue, maxValue))}
					/>
					<StepButton
						icon="plus"
						label={`Increase ${title}`}
						disabled={disabled}
						onPress={() => onChangeText(adjustNumber(text, step, minValue, maxValue))}
					/>
				</View>
			</InlineRow>
			<Helper helper={helper} />
		</View>
	);
}

export function FormValueRow({ title, value, helper, monospaced }: FormValueRowProps) {
	return (
		<View>
			<InlineRow title={title}>
				<Text
					selectable
					style={[
						m3Type.bodyLarge,
						{ color: colors.secondaryLabel, textAlign: 'right' },
						monospaced && { fontFamily: monoFamily }
					]}
				>
					{value}
				</Text>
			</InlineRow>
			<Helper helper={helper} />
		</View>
	);
}

export function FormPicker<Value extends string | number>({
	title,
	selection,
	onSelectionChange,
	options,
	helper
}: FormPickerProps<Value>) {
	const [expanded, setExpanded] = useState(false);
	const current = options.find((o) => o.value === selection);
	return (
		<View>
			<Pressable
				onPress={() => setExpanded(true)}
				accessibilityRole="button"
				accessibilityValue={{ text: current?.label }}
				android_ripple={{ color: colors.separator as string }}
			>
				<InlineRow title={title}>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
						<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel }]}>
							{current?.label ?? ''}
						</Text>
						<Icon name="chevron.up.chevron.down" size={18} color={colors.secondaryLabel} />
					</View>
				</InlineRow>
			</Pressable>
			<Host matchContents style={{ position: 'absolute', right: 16, bottom: 0 }}>
				<DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
					<DropdownMenu.Items>
						{options.map((option) => (
							<DropdownMenuItem
								key={String(option.value)}
								onClick={() => {
									setExpanded(false);
									onSelectionChange(option.value);
								}}
							>
								<DropdownMenuItem.Text>
									<ComposeText>
										{option.value === selection ? `${option.label}  ✓` : option.label}
									</ComposeText>
								</DropdownMenuItem.Text>
							</DropdownMenuItem>
						))}
					</DropdownMenu.Items>
				</DropdownMenu>
			</Host>
			<Helper helper={helper} />
		</View>
	);
}
