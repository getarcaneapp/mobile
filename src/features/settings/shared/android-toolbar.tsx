import { MenuView } from '@react-native-menu/menu';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View, type ColorValue } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { m3 } from '@/ui/components/material-colors';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { Icon } from '@/ui/Icon';

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

function IconGlyph({
	icon,
	color,
	disabled
}: {
	icon: string;
	color?: ColorValue;
	disabled?: boolean;
}) {
	return (
		<View
			style={{
				width: 48,
				height: 48,
				alignItems: 'center',
				justifyContent: 'center',
				opacity: disabled ? 0.38 : 1
			}}
		>
			<Icon name={icon} size={24} color={color ?? m3.onSurfaceVariant} />
		</View>
	);
}

export function AndroidToolbar({
	placement = 'right',
	items
}: {
	placement?: 'left' | 'right';
	items: AndroidToolbarItem[];
}) {
	return (
		<Stack.Toolbar placement={placement}>
			<Stack.Toolbar.View>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					{items.map((item) => {
						if (item.kind === 'spinner') {
							return (
								<View
									key={item.id}
									style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
								>
									<ActivityIndicator accessibilityLabel={item.label} />
								</View>
							);
						}
						if (item.kind === 'button') {
							return (
								<Pressable
									key={item.id}
									onPress={item.onPress}
									disabled={item.disabled}
									accessibilityRole="button"
									accessibilityLabel={item.label}
									accessibilityState={{ disabled: item.disabled }}
									android_ripple={{
										color: colors.separator as string,
										borderless: true,
										radius: 20
									}}
								>
									<IconGlyph icon={item.icon} color={item.color} disabled={item.disabled} />
								</Pressable>
							);
						}
						if (item.disabled) return <IconGlyph key={item.id} icon={item.icon} disabled />;
						return (
							<MenuView
								key={item.id}
								actions={item.items.map((entry) => ({
									id: entry.id,
									title: entry.title,
									state: entry.checked === undefined ? undefined : entry.checked ? 'on' : 'off',
									image: entry.selected ? 'menu_check' : undefined,
									attributes: { destructive: entry.destructive, disabled: entry.disabled }
								}))}
								onPressAction={({ nativeEvent }) =>
									item.items.find((entry) => entry.id === nativeEvent.event)?.onPress()
								}
							>
								<View accessible accessibilityRole="button" accessibilityLabel={item.label}>
									<IconGlyph icon={item.icon} />
								</View>
							</MenuView>
						);
					})}
				</View>
			</Stack.Toolbar.View>
		</Stack.Toolbar>
	);
}

export function AndroidResourceActionsToolbar({
	primary,
	secondary = [],
	overflow = [],
	runningItemID,
	isDisabled = false,
	resourceName
}: {
	primary?: ActionButtonItem;
	secondary?: ActionButtonItem[];
	overflow?: ActionButtonItem[];
	runningItemID?: string;
	isDisabled?: boolean;
	resourceName?: string;
}) {
	const [pending, setPending] = useState<ActionButtonItem>();
	useItemDeleteConfirmation(pending, setPending, (item) => ({
		title: resourceName ? `${item.title} ${resourceName}?` : `${item.title}?`,
		message: item.confirmationMessage,
		icon: item.systemImage,
		actions: [
			{
				title: item.title,
				tint: item.role === 'destructive' ? undefined : item.tint,
				action: item.action
			}
		],
		dismissOnConfirm: item.dismissOnConfirm ?? true
	}));
	const handle = (item: ActionButtonItem) =>
		item.role === 'destructive' || item.confirmationMessage !== undefined
			? setPending(item)
			: item.action();
	const disabled = (item: ActionButtonItem) =>
		isDisabled || (runningItemID !== undefined && runningItemID !== item.id);
	const menuItems = [...secondary, ...overflow];
	const items: AndroidToolbarItem[] = [];
	if (primary) {
		items.push(
			runningItemID === primary.id
				? { kind: 'spinner', id: primary.id, label: primary.title }
				: {
						kind: 'button',
						id: primary.id,
						icon: primary.systemImage,
						label: primary.title,
						color: primary.role === 'destructive' ? systemColors.red : primary.tint,
						disabled: disabled(primary),
						onPress: () => handle(primary)
					}
		);
	}
	if (menuItems.length > 0) {
		items.push({
			kind: 'menu',
			id: 'overflow',
			icon: 'ellipsis.circle',
			label: 'More actions',
			disabled: isDisabled,
			items: menuItems.map((item) => ({
				id: item.id,
				title: item.title,
				destructive: item.role === 'destructive' || item.tint === systemColors.red,
				disabled: disabled(item),
				onPress: () => handle(item)
			}))
		});
	}
	return <AndroidToolbar items={items} />;
}
