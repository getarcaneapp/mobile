import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';
import { M3Switch } from '@/ui/material/switch';

export function M3Section({
	title,
	footer,
	children
}: {
	title?: string;
	footer?: string;
	children: ReactNode;
}) {
	return (
		<View>
			{title ? <MaterialSectionHeader title={title} /> : <View style={{ height: 12 }} />}
			<MaterialListGroup>{children}</MaterialListGroup>
			{footer ? (
				<Text
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
					]}
				>
					{footer}
				</Text>
			) : null}
		</View>
	);
}

export function RadioGroup<Value extends string>({
	options,
	selection,
	onSelect
}: {
	options: { value: Value; title: string; icon?: string }[];
	selection: Value;
	onSelect: (value: Value) => void;
}) {
	return (
		<>
			{options.map((option) => {
				const selected = option.value === selection;
				return (
					<Pressable
						key={option.value}
						onPress={() => onSelect(option.value)}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
						android_ripple={{ color: colors.separator as string }}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 16,
							minHeight: 56,
							paddingHorizontal: 16
						}}
					>
						<View
							style={{
								width: 20,
								height: 20,
								borderRadius: 10,
								borderWidth: 2,
								borderColor: selected ? m3.primary : m3.onSurfaceVariant,
								alignItems: 'center',
								justifyContent: 'center'
							}}
						>
							{selected ? (
								<View
									style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m3.primary }}
								/>
							) : null}
						</View>
						{option.icon ? (
							<Icon name={option.icon} size={20} color={colors.secondaryLabel} />
						) : null}
						<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{option.title}</Text>
					</Pressable>
				);
			})}
		</>
	);
}

export function SwitchRow({
	title,
	value,
	onValueChange,
	disabled,
	icon
}: {
	title: string;
	value: boolean;
	onValueChange: (value: boolean) => void;
	disabled?: boolean;
	icon?: string;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 56,
				paddingHorizontal: 16,
				opacity: disabled ? 0.5 : 1
			}}
		>
			{icon ? <Icon name={icon} size={22} color={colors.secondaryLabel} /> : null}
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
			<M3Switch
				value={value}
				disabled={disabled}
				onValueChange={onValueChange}
				accessibilityLabel={title}
			/>
		</View>
	);
}

export function M3TextField({
	label,
	value,
	onChangeText,
	multiline,
	monospaced,
	keyboardType,
	editable = true
}: {
	label: string;
	value: string;
	onChangeText: (text: string) => void;
	multiline?: boolean;
	monospaced?: boolean;
	keyboardType?: KeyboardTypeOptions;
	editable?: boolean;
}) {
	return (
		<View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={label}
				placeholderTextColor={colors.secondaryLabel}
				accessibilityLabel={label}
				cursorColor={m3.primary as string}
				selectionColor={m3.primary as string}
				editable={editable}
				multiline={multiline}
				keyboardType={keyboardType}
				autoCapitalize="none"
				autoCorrect={false}
				style={[
					m3Type.bodyLarge,
					{
						color: colors.label,
						borderWidth: 1,
						borderColor: m3.outline,
						borderRadius: 4,
						paddingHorizontal: 12,
						paddingVertical: 10,
						minHeight: multiline ? 72 : 48,
						textAlignVertical: multiline ? 'top' : 'center',
						fontFamily: monospaced ? monoFamily : undefined
					}
				]}
			/>
			{value ? (
				<Text
					pointerEvents="none"
					style={[
						m3Type.bodySmall,
						{
							position: 'absolute',
							left: 24,
							top: 0,
							paddingHorizontal: 4,
							color: colors.secondaryLabel,
							backgroundColor: colors.secondarySystemGroupedBackground
						}
					]}
				>
					{label}
				</Text>
			) : null}
		</View>
	);
}

export function ValueRow({
	title,
	value,
	monospaced,
	valueColor,
	selectable = true
}: {
	title: string;
	value: string;
	monospaced?: boolean;
	valueColor?: string;
	selectable?: boolean;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 48,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{title}</Text>
			<Text
				selectable={selectable}
				style={[
					m3Type.bodyMedium,
					{
						flex: 1,
						textAlign: 'right',
						color: valueColor ?? colors.secondaryLabel,
						fontFamily: monospaced ? monoFamily : undefined
					}
				]}
			>
				{value}
			</Text>
		</View>
	);
}

export function TextButtonRow({
	title,
	onPress,
	destructive,
	disabled
}: {
	title: string;
	onPress: () => void;
	destructive?: boolean;
	disabled?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{
				minHeight: 48,
				justifyContent: 'center',
				paddingHorizontal: 16,
				opacity: disabled ? 0.5 : 1
			}}
		>
			<Text style={[m3Type.labelLarge, { color: destructive ? m3.error : m3.primary }]}>
				{title}
			</Text>
		</Pressable>
	);
}

export function CenteredMessage({
	icon,
	title,
	message,
	action
}: {
	icon: string;
	title: string;
	message: string;
	action?: { title: string; onPress: () => void };
}) {
	return (
		<View
			style={{
				flex: 1,
				alignItems: 'center',
				justifyContent: 'center',
				padding: 32,
				gap: 8,
				backgroundColor: colors.systemGroupedBackground
			}}
		>
			<Icon name={icon} size={44} color={colors.secondaryLabel} />
			<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
				{message}
			</Text>
			{action ? <TextButtonRow title={action.title} onPress={action.onPress} /> : null}
		</View>
	);
}
