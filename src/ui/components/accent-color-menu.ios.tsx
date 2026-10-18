import {
	Button,
	Circle,
	ColorPicker,
	Divider,
	HStack,
	Label,
	Menu,
	Text,
	Toggle
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	accessibilityValue,
	contentShape,
	disabled,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	resizable,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { useColorScheme } from 'react-native';

import { AccentColorOptions } from '@/theme/accent';
import { systemColors } from '@/theme/colors';

import { accentMenuDotsDark, accentMenuDotsLight } from './accent-menu-dots';
import {
	accentMenuColor,
	selectedAccentOption,
	type AccentColorMenuProps,
	type CustomAccentColorPickerProps
} from './accent-color-menu.types';

export function AccentColorMenu({
	selection,
	onSelectionChange,
	isAvailable = () => true,
	onCustom,
	unnamedTitle = 'Custom',
	accessibilityLabel: label = 'Accent color'
}: AccentColorMenuProps) {
	const selected = selectedAccentOption(selection);
	const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
	const color = selected ? systemColors[selected.id] : accentMenuColor(selection);
	const dots = scheme === 'light' ? accentMenuDotsLight : accentMenuDotsDark;
	return (
		<Menu
			modifiers={[
				accessibilityLabel(label),
				accessibilityValue(selected?.displayName ?? unnamedTitle)
			]}
			label={
				<HStack
					spacing={8}
					modifiers={[
						font({ textStyle: 'subheadline' }),
						fixedSize(),
						contentShape(shapes.rectangle())
					]}
				>
					<Circle modifiers={[foregroundStyle(color), frame({ width: 9, height: 9 })]} />
					<Text modifiers={[foregroundStyle(color)]}>{selected?.displayName ?? unnamedTitle}</Text>
					<Image
						systemName="chevron.up.chevron.down"
						modifiers={[
							font({ textStyle: 'caption2', weight: 'semibold' }),
							foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
						]}
					/>
				</HStack>
			}
		>
			{AccentColorOptions.map((option) => (
				<Toggle
					key={option.id}
					isOn={selected?.id === option.id}
					onIsOnChange={(isOn) => {
						if (isOn) onSelectionChange(option.hex);
					}}
					modifiers={[disabled(!isAvailable(option.hex))]}
				>
					<Label
						title={option.displayName}
						icon={
							<Image
								uiImage={dots[option.id]}
								modifiers={[resizable(), frame({ width: 15, height: 15 })]}
							/>
						}
					/>
				</Toggle>
			))}
			{onCustom ? (
				<>
					<Divider />
					<Button label="Custom…" systemImage="paintpalette" onPress={onCustom} />
				</>
			) : null}
		</Menu>
	);
}

export function CustomAccentColorPicker({
	selection,
	onSelectionChange
}: CustomAccentColorPickerProps) {
	return (
		<ColorPicker
			label="Custom Color"
			selection={selection}
			supportsOpacity={false}
			onSelectionChange={(hex) => onSelectionChange(hex.slice(0, 7).toUpperCase())}
		/>
	);
}
