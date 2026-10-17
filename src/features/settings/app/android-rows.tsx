import { Host } from '@expo/ui';
import { DropdownMenu, DropdownMenuItem, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, Text, View, type ColorValue } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { M3Switch } from '@/ui/material/switch';

export function MenuValueRow<Value extends string | number>({
	title,
	icon,
	iconColor,
	options,
	selection,
	onSelect
}: {
	title: string;
	icon: string;
	iconColor: ColorValue;
	options: readonly { value: Value; title: string }[];
	selection: Value;
	onSelect: (value: Value) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const selected = options.find((option) => option.value === selection);
	return (
		<View>
			<Pressable
				onPress={() => setExpanded(true)}
				accessibilityRole="button"
				accessibilityLabel={`${title}, ${selected?.title ?? ''}`}
				android_ripple={{ color: colors.separator as string }}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 16,
					minHeight: 56,
					paddingHorizontal: 16
				}}
			>
				<Icon name={icon} size={24} color={iconColor} />
				<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
				<Text style={[m3Type.bodyMedium, { color: m3.primary }]}>{selected?.title}</Text>
				<Icon name="chevron.up.chevron.down" size={16} color={colors.tertiaryLabel} />
			</Pressable>
			<Host matchContents style={{ position: 'absolute', right: 16, bottom: 0 }}>
				<DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
					<DropdownMenu.Items>
						{options.map((option) => (
							<DropdownMenuItem
								key={String(option.value)}
								onClick={() => {
									setExpanded(false);
									onSelect(option.value);
								}}
							>
								<DropdownMenuItem.Text>
									<ComposeText>
										{option.value === selection ? `${option.title}  ✓` : option.title}
									</ComposeText>
								</DropdownMenuItem.Text>
							</DropdownMenuItem>
						))}
					</DropdownMenu.Items>
				</DropdownMenu>
			</Host>
		</View>
	);
}

export function IconSwitchRow({
	title,
	icon,
	iconColor,
	value,
	onValueChange,
	disabled
}: {
	title: string;
	icon: string;
	iconColor: ColorValue;
	value: boolean;
	onValueChange: (value: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			onPress={() => onValueChange(!value)}
			disabled={disabled}
			accessibilityRole="switch"
			accessibilityState={{ checked: value, disabled }}
			accessibilityLabel={title}
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
			<Icon name={icon} size={24} color={iconColor} />
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
			<M3Switch value={value} disabled={disabled} onValueChange={onValueChange} />
		</Pressable>
	);
}
