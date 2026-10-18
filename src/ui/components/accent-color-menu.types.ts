import { AccentColorOptions, type AccentColorOption } from '@/theme/accent';
import { parseHex, systemColors } from '@/theme/colors';

export type AccentColorMenuProps = {
	selection: string;
	onSelectionChange: (hex: string) => void;
	isAvailable?: (hex: string) => boolean;
	onCustom?: () => void;
	unnamedTitle?: string;
	accessibilityLabel?: string;
};

export function selectedAccentOption(selection: string): AccentColorOption | undefined {
	return AccentColorOptions.find((o) => o.hex.toLowerCase() === selection.toLowerCase());
}

export function accentMenuColor(selection: string): string {
	return selectedAccentOption(selection)?.hex ?? parseHex(selection) ?? systemColors.purple;
}

export type CustomAccentColorPickerProps = {
	selection: string;
	onSelectionChange: (hex: string) => void;
};
