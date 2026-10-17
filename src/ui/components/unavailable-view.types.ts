import type { ReactNode } from 'react';

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
	fills?: boolean;
	children?: ReactNode;
};
