import type { ColorValue } from 'react-native';

import type { ActionButtonItem } from '@/ui/components/toolbar';

export type AndroidMenuItem = {
	id: string;
	title: string;
	destructive?: boolean;
	disabled?: boolean;
	checked?: boolean;
	selected?: boolean;
	onPress: () => void;
};

export type AndroidToolbarItem =
	| {
			kind: 'button';
			id: string;
			icon: string;
			label: string;
			onPress: () => void;
			disabled?: boolean;
			color?: ColorValue;
	  }
	| {
			kind: 'menu';
			id: string;
			icon: string;
			label: string;
			items: AndroidMenuItem[];
			disabled?: boolean;
	  }
	| { kind: 'spinner'; id: string; label: string };

export type AndroidToolbarProps = {
	placement?: 'left' | 'right';
	items: AndroidToolbarItem[];
};

export type AndroidResourceActionsToolbarProps = {
	primary?: ActionButtonItem;
	secondary?: ActionButtonItem[];
	overflow?: ActionButtonItem[];
	runningItemID?: string;
	isDisabled?: boolean;
	resourceName?: string;
};
