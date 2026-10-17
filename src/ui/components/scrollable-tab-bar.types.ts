/** Port of `ScrollableTabOption`. */
export type ScrollableTabOption<Selection extends string> = {
	value: Selection;
	title: string;
	systemImage: string;
	/** Hex; defaults to the app accent. */
	tint?: string;
};

export type ScrollableTabBarProps<Selection extends string> = {
	selection: Selection;
	onSelectionChange: (value: Selection) => void;
	options: ScrollableTabOption<Selection>[];
	accessibilityLabel: string;
};
