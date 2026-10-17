import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActionSheetIOS, Pressable, type StyleProp, type ViewStyle } from 'react-native';

export type RowMenuItem = {
	id: string;
	title: string;
	destructive?: boolean;
	disabled?: boolean;
	onPress: () => void;
};

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
	const enabled = items.filter((item) => !item.disabled);
	const showMenu = () => {
		void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		const destructiveIndex = enabled.findIndex((item) => item.destructive);
		ActionSheetIOS.showActionSheetWithOptions(
			{
				title,
				options: [...enabled.map((item) => item.title), 'Cancel'],
				cancelButtonIndex: enabled.length,
				destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined
			},
			(index) => enabled[index]?.onPress()
		);
	};
	return (
		<Pressable
			onPress={onPress}
			onLongPress={enabled.length > 0 ? showMenu : undefined}
			accessibilityRole={onPress ? 'button' : undefined}
			accessibilityLabel={accessibilityLabel}
			accessibilityActions={enabled.map((item) => ({ name: item.id, label: item.title }))}
			onAccessibilityAction={(event) =>
				enabled.find((item) => item.id === event.nativeEvent.actionName)?.onPress()
			}
			style={style}
		>
			{children}
		</Pressable>
	);
}
