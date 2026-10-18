import { MenuView, type MenuComponentRef } from '@react-native-menu/menu';
import { useMemo, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

export type RowMenuItem = {
	id: string;
	title: string;
	destructive?: boolean;
	disabled?: boolean;
	onPress: () => void;
};

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

type SplitStyle = { outer: ViewStyle; inner: ViewStyle };

const emptySplit: SplitStyle = { outer: {}, inner: {} };
const splitCache = new WeakMap<object, SplitStyle>();

function computeSplitStyle(style: StyleProp<ViewStyle>): SplitStyle {
	const outer: Record<string, unknown> = {};
	const inner: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(
		(StyleSheet.flatten(style as never) as ViewStyle | undefined) ?? {}
	)) {
		(outerKeys.has(key) ? outer : inner)[key] = value;
	}
	return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

function splitStyle(style: StyleProp<ViewStyle>): SplitStyle {
	if (style === undefined || style === null || style === false) return emptySplit;
	if (typeof style !== 'object') return computeSplitStyle(style);
	const cached = splitCache.get(style);
	if (cached) return cached;
	const split = computeSplitStyle(style);
	splitCache.set(style, split);
	return split;
}

type MenuActionDescriptor = {
	id: string;
	title: string;
	destructive?: boolean;
	disabled?: boolean;
};

function actionsSignature(items: RowMenuItem[]): string {
	return JSON.stringify(
		items.map((item): MenuActionDescriptor => ({
			id: item.id,
			title: item.title,
			destructive: item.destructive,
			disabled: item.disabled
		}))
	);
}

function menuActions(signature: string) {
	const descriptors = JSON.parse(signature) as MenuActionDescriptor[];
	return {
		actions: descriptors.map((item) => ({
			id: item.id,
			title: item.title,
			attributes: { destructive: item.destructive, disabled: item.disabled }
		})),
		accessibilityActions: descriptors.map((item) => ({ name: item.id, label: item.title }))
	};
}

function noop() {}

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
	const { outer, inner } = useMemo(() => splitStyle(style), [style]);
	const signature = actionsSignature(items);
	const { actions, accessibilityActions } = useMemo(() => menuActions(signature), [signature]);
	return (
		<MenuView
			ref={menu}
			shouldOpenOnLongPress
			style={outer}
			title={title}
			actions={actions}
			onPressAction={({ nativeEvent }) =>
				items.find((item) => item.id === nativeEvent.event)?.onPress()
			}
		>
			<Pressable
				onPress={onPress}
				onLongPress={items.length > 0 ? noop : undefined}
				accessibilityRole={onPress ? 'button' : undefined}
				accessibilityLabel={accessibilityLabel}
				accessibilityActions={accessibilityActions}
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
