import type { ReactNode } from 'react';

/**
 * `ContentUnavailableView { Label(…) } description: { … } actions: { … }`
 * with any number of action buttons.
 */
export type UnavailableAction = {
	title: string;
	onPress: () => void;
	disabled?: boolean;
	isBusy?: boolean;
};

export type UnavailableViewProps = {
	title: string;
	systemImage: string;
	description?: string;
	actions?: UnavailableAction[];
	/** Fill the available space (Swift: the view is the screen's only content). Defaults to true. */
	fills?: boolean;
	/** Custom action content (e.g. an environment menu button), placed after `actions`. */
	children?: ReactNode;
};
