import { Host } from '@expo/ui';
import {
	Box,
	DropdownMenu,
	DropdownMenuItem,
	HorizontalDivider,
	Text as ComposeText
} from '@expo/ui/jetpack-compose';
import { background, clip, Shapes, size } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AccentColorOptions } from '@/theme/accent';
import { colors, parseHex } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import {
	accentMenuColor,
	selectedAccentOption,
	type AccentColorMenuProps,
	type CustomAccentColorPickerProps
} from './accent-color-menu.types';
import { m3 } from './material-colors';
import { m3Type } from './type-scale';

export function AccentColorMenu({
	selection,
	onSelectionChange,
	isAvailable = () => true,
	onCustom
}: AccentColorMenuProps) {
	const [expanded, setExpanded] = useState(false);
	const selected = selectedAccentOption(selection);
	const color = accentMenuColor(selection);
	return (
		<View>
			<Pressable
				onPress={() => setExpanded(true)}
				accessibilityRole="button"
				accessibilityLabel={`Accent color, ${selected?.displayName ?? 'Custom'}`}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 8,
					minHeight: 40,
					paddingHorizontal: 4
				}}
			>
				<View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: color }} />
				<Text style={[m3Type.bodyMedium, { color }]}>{selected?.displayName ?? 'Custom'}</Text>
				<Icon name="chevron.up.chevron.down" size={16} color={colors.tertiaryLabel} />
			</Pressable>
			<Host matchContents style={{ position: 'absolute', right: 0, bottom: 0 }}>
				<DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
					<DropdownMenu.Items>
						{AccentColorOptions.map((option) => (
							<DropdownMenuItem
								key={option.id}
								enabled={isAvailable(option.hex)}
								onClick={() => {
									setExpanded(false);
									onSelectionChange(option.hex);
								}}
							>
								<DropdownMenuItem.LeadingIcon>
									<Box modifiers={[size(12, 12), clip(Shapes.Circle), background(option.hex)]} />
								</DropdownMenuItem.LeadingIcon>
								<DropdownMenuItem.Text>
									<ComposeText>
										{selected?.id === option.id ? `${option.displayName}  ✓` : option.displayName}
									</ComposeText>
								</DropdownMenuItem.Text>
							</DropdownMenuItem>
						))}
						{onCustom ? (
							<>
								<HorizontalDivider />
								<DropdownMenuItem
									onClick={() => {
										setExpanded(false);
										onCustom();
									}}
								>
									<DropdownMenuItem.Text>
										<ComposeText>Custom…</ComposeText>
									</DropdownMenuItem.Text>
								</DropdownMenuItem>
							</>
						) : null}
					</DropdownMenu.Items>
				</DropdownMenu>
			</Host>
		</View>
	);
}

const swatches = [
	'#F44336',
	'#E91E63',
	'#9C27B0',
	'#673AB7',
	'#3F51B5',
	'#2196F3',
	'#03A9F4',
	'#00BCD4',
	'#009688',
	'#4CAF50',
	'#8BC34A',
	'#CDDC39',
	'#FFEB3B',
	'#FFC107',
	'#FF9800',
	'#FF5722',
	'#795548',
	'#607D8B'
];

export function CustomAccentColorPicker({
	selection,
	onSelectionChange
}: CustomAccentColorPickerProps) {
	const [draft, setDraft] = useState(selection.replace('#', ''));
	return (
		<View style={{ gap: 16, padding: 16 }}>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
				{swatches.map((hex) => (
					<Pressable
						key={hex}
						accessibilityRole="button"
						accessibilityLabel={hex}
						accessibilityState={{ selected: hex.toLowerCase() === selection.toLowerCase() }}
						onPress={() => {
							setDraft(hex.slice(1));
							onSelectionChange(hex);
						}}
						style={{
							width: 40,
							height: 40,
							borderRadius: 20,
							backgroundColor: hex,
							borderWidth: hex.toLowerCase() === selection.toLowerCase() ? 3 : 0,
							borderColor: m3.primary
						}}
					/>
				))}
			</View>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 8,
					borderWidth: 1,
					borderColor: m3.outline,
					borderRadius: 4,
					paddingHorizontal: 12,
					height: 56
				}}
			>
				<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel }]}>#</Text>
				<TextInput
					value={draft}
					maxLength={6}
					autoCapitalize="characters"
					autoCorrect={false}
					onChangeText={(text) => {
						setDraft(text);
						const hex = parseHex(text);
						if (hex) onSelectionChange(hex);
					}}
					style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
				/>
				<View
					style={{
						width: 24,
						height: 24,
						borderRadius: 12,
						backgroundColor: parseHex(draft) ?? selection
					}}
				/>
			</View>
		</View>
	);
}
