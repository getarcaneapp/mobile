import { AccentColorOptions, type AccentColorOption } from '@/theme/accent';
import { parseHex, systemColors } from '@/theme/colors';

export type AccentColorMenuProps = {
	/** Selected hex (`accentColorHex`). */
	selection: string;
	onSelectionChange: (hex: string) => void;
	isAvailable?: (hex: string) => boolean;
	/** Shows "Custom…" after a divider when set. */
	onCustom?: () => void;
};

export function selectedAccentOption(selection: string): AccentColorOption | undefined {
	return AccentColorOptions.find((o) => o.hex.toLowerCase() === selection.toLowerCase());
}

/** The label's dot/text color: the option, the custom hex, or purple. */
export function accentMenuColor(selection: string): string {
	return selectedAccentOption(selection)?.hex ?? parseHex(selection) ?? systemColors.purple;
}

export type CustomAccentColorPickerProps = {
	selection: string;
	onSelectionChange: (hex: string) => void;
};
