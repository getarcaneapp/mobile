import { Stack } from 'expo-router';
import { AppToolbar as AccentToolbar } from '@/ui/app-toolbar';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemColors } from '@/theme/colors';

import { useToolbarIcons } from '@/ui/toolbar-icon';

import { useItemDeleteConfirmation } from './delete-confirmation';
import {
	environmentActionIsMenu,
	environmentTitle,
	type EnvironmentActionButtonProps
} from './environment-label.types';

type Placement = 'left' | 'right' | 'bottom';

export function AppToolbar({
	placement = 'right',
	children
}: {
	placement?: Placement;
	children: ReactNode;
}) {
	return <AccentToolbar placement={placement}>{children}</AccentToolbar>;
}

export type ActionButtonItem = {
	id: string;
	title: string;
	systemImage: string;
	tint: string;
	role?: 'destructive';
	confirmationMessage?: string;
	action: () => void;
};

export type ResourceActionsToolbarProps = {
	primary?: ActionButtonItem;
	secondary?: ActionButtonItem[];
	overflow?: ActionButtonItem[];
	runningItemID?: string;
	isDisabled?: boolean;
	resourceName?: string;
	active?: boolean;
};

const isDestructive = (item: ActionButtonItem) =>
	item.role === 'destructive' || item.tint === systemColors.red;

export function ResourceActionsToolbar({
	primary,
	secondary = [],
	overflow = [],
	runningItemID,
	isDisabled = false,
	resourceName,
	active = true
}: ResourceActionsToolbarProps) {
	const [pendingDestructive, setPendingDestructive] = useState<ActionButtonItem>();
	const menuItems = [...secondary, ...overflow];
	const icon = useToolbarIcons([primary?.systemImage ?? '', 'ellipsis.circle']);

	useItemDeleteConfirmation(pendingDestructive, setPendingDestructive, (item) => ({
		title: resourceName ? `${item.title} ${resourceName}?` : `${item.title}?`,
		message:
			item.confirmationMessage ??
			(resourceName
				? `Are you sure you want to ${item.title.toLowerCase()} ${resourceName}?`
				: `Are you sure you want to ${item.title.toLowerCase()}?`),
		icon: item.systemImage,
		actions: [{ title: item.title, action: item.action }]
	}));

	const handle = (item: ActionButtonItem) => {
		if (item.role === 'destructive') setPendingDestructive(item);
		else item.action();
	};
	const disabled = (item: ActionButtonItem) =>
		isDisabled || (runningItemID !== undefined && runningItemID !== item.id);

	if (!active) return null;
	return (
		<AccentToolbar placement="right">
			{primary ? (
				runningItemID === primary.id ? (
					<Stack.Toolbar.View>
						<ActivityIndicator accessibilityLabel={primary.title} />
					</Stack.Toolbar.View>
				) : (
					<Stack.Toolbar.Button
						icon={icon(primary.systemImage)}
						tintColor={primary.role === 'destructive' ? systemColors.red : primary.tint}
						accessibilityLabel={primary.title}
						disabled={disabled(primary)}
						onPress={() => handle(primary)}
					/>
				)
			) : null}
			{menuItems.length > 0 ? (
				<Stack.Toolbar.Menu
					icon={icon('ellipsis.circle')}
					accessibilityLabel="More actions"
					disabled={isDisabled}
				>
					{menuItems.map((item) => (
						<Stack.Toolbar.MenuAction
							key={item.id}
							icon={item.systemImage as SFSymbol}
							destructive={isDestructive(item)}
							disabled={disabled(item)}
							onPress={() => handle(item)}
						>
							{item.title}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			) : null}
		</AccentToolbar>
	);
}

export function EnvironmentToolbarAction({
	title,
	systemImage,
	environments,
	action
}: EnvironmentActionButtonProps) {
	const first = environments[0];
	if (environmentActionIsMenu(environments)) {
		return (
			<Stack.Toolbar.Menu title={title} icon={systemImage as SFSymbol}>
				{environments.map((environment) => (
					<Stack.Toolbar.MenuAction key={environment.id} onPress={() => action(environment.id)}>
						{environmentTitle(environment)}
					</Stack.Toolbar.MenuAction>
				))}
			</Stack.Toolbar.Menu>
		);
	}
	if (!first) return null;
	return (
		<Stack.Toolbar.MenuAction icon={systemImage as SFSymbol} onPress={() => action(first.id)}>
			{title}
		</Stack.Toolbar.MenuAction>
	);
}
