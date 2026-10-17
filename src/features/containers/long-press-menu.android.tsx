/**
 * Android stand-in for SwiftUI `.contextMenu` / `.swipeActions` on list rows:
 * tap runs `onPress`, long-press opens a native popup menu of the row's actions.
 */
import { MenuView, type MenuComponentRef } from '@react-native-menu/menu';
import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

export type RowMenuItem = {
	id: string;
	title: string;
	destructive?: boolean;
	disabled?: boolean;
	onPress: () => void;
};

/** Layout keys that size the row inside its parent; they belong on the outer `MenuView`, not the inner `Pressable`. */
const outerKeys = new Set<string>([
	'flex',
	'flexGrow',
	'flexShrink',
	'flexBasis',
	'alignSelf',
	'width',
	'minWidth',
	'maxWidth',
	'margin',
	'marginHorizontal',
	'marginVertical',
	'marginTop',
	'marginBottom',
	'marginLeft',
	'marginRight',
	'marginStart',
	'marginEnd'
]);

function splitStyle(style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
	const outer: Record<string, unknown> = {};
	const inner: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(
		(StyleSheet.flatten(style as never) as ViewStyle | undefined) ?? {}
	)) {
		(outerKeys.has(key) ? outer : inner)[key] = value;
	}
	return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

export function LongPressMenu({
	items,
	onPress,
	title,
	style,
	accessibilityLabel,
	children
}: {
	items: RowMenuItem[];
	onPress?: () => void;
	title?: string;
	style?: StyleProp<ViewStyle>;
	accessibilityLabel?: string;
	children: ReactNode;
}) {
	const menu = useRef<MenuComponentRef>(null);
	const { outer, inner } = splitStyle(style);
	return (
		// The native view opens the menu on long-press itself: its imperative `show()`
		// command only has an int-ID handler, which the new architecture never calls.
		<MenuView
			ref={menu}
			shouldOpenOnLongPress
			style={outer}
			title={title}
			actions={items.map((item) => ({
				id: item.id,
				title: item.title,
				attributes: { destructive: item.destructive, disabled: item.disabled }
			}))}
			onPressAction={({ nativeEvent }) =>
				items.find((item) => item.id === nativeEvent.event)?.onPress()
			}
		>
			<Pressable
				onPress={onPress}
				// No-op so a long-press doesn't also fire `onPress` on release.
				onLongPress={items.length > 0 ? () => {} : undefined}
				accessibilityRole={onPress ? 'button' : undefined}
				accessibilityLabel={accessibilityLabel}
				accessibilityActions={items.map((item) => ({ name: item.id, label: item.title }))}
				onAccessibilityAction={(event) =>
					items.find((item) => item.id === event.nativeEvent.actionName)?.onPress()
				}
				android_ripple={{ color: colors.separator as string }}
				style={inner}
			>
				{children}
			</Pressable>
		</MenuView>
	);
}
