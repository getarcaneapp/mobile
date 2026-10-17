/**
 * Port of `AppToolbarItem` (AppToolbarItem.swift): header toolbar items tint
 * their symbols with the app accent (`appAccentToolbarSymbol()`).
 *
 * `Stack.Toolbar`'s own `tintColor` never reaches individual header items, so
 * this wrapper hands the accent to every `Button` / `Menu` that doesn't set
 * its own `tintColor` (e.g. Prune's red trash keeps its red).
 */
import { Stack } from 'expo-router';
import {
	Children,
	cloneElement,
	Fragment,
	isValidElement,
	type ComponentProps,
	type ReactNode
} from 'react';

import { useAccentColor } from '@/theme/accent';

type AppToolbarProps = ComponentProps<typeof Stack.Toolbar>;

const tintable = new Set<unknown>([Stack.Toolbar.Button, Stack.Toolbar.Menu]);

function withAccent(children: ReactNode, accent: string): ReactNode {
	return Children.map(children, (child) => {
		if (!isValidElement<{ children?: ReactNode; tintColor?: string }>(child)) return child;
		if (child.type === Fragment)
			return cloneElement(child, undefined, withAccent(child.props.children, accent));
		if (tintable.has(child.type) && child.props.tintColor === undefined)
			return cloneElement(child, { tintColor: accent });
		return child;
	});
}

export function AppToolbar({ children, ...props }: AppToolbarProps) {
	const accent = useAccentColor();
	const placement = props.placement ?? 'bottom';
	return (
		<Stack.Toolbar {...props}>
			{placement === 'bottom' ? children : withAccent(children, accent)}
		</Stack.Toolbar>
	);
}

AppToolbar.Button = Stack.Toolbar.Button;
AppToolbar.Menu = Stack.Toolbar.Menu;
AppToolbar.MenuAction = Stack.Toolbar.MenuAction;
AppToolbar.SearchBarSlot = Stack.Toolbar.SearchBarSlot;
AppToolbar.Spacer = Stack.Toolbar.Spacer;
AppToolbar.View = Stack.Toolbar.View;
AppToolbar.Label = Stack.Toolbar.Label;
AppToolbar.Icon = Stack.Toolbar.Icon;
AppToolbar.Badge = Stack.Toolbar.Badge;
