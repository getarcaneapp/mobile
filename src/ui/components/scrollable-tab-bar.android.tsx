import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors, withOpacity } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import { m3 } from './material-colors';
import type { ScrollableTabBarProps } from './scrollable-tab-bar.types';
import { m3Type } from './type-scale';

export function ScrollableTabBar<Selection extends string>({
	selection,
	onSelectionChange,
	options,
	accessibilityLabel
}: ScrollableTabBarProps<Selection>) {
	const accent = useAccentColor();
	const scroll = useRef<ScrollViewInstance>(null);
	const [viewport, setViewport] = useState(0);
	const frames = useRef(new Map<string, { x: number; width: number }>());

	useEffect(() => {
		const frame = frames.current.get(selection);
		if (!frame || viewport === 0) return;
		scroll.current?.scrollTo({
			x: Math.max(0, frame.x + frame.width / 2 - viewport / 2),
			animated: true
		});
	}, [selection, viewport]);

	return (
		<View
			accessibilityLabel={accessibilityLabel}
			style={{ paddingVertical: 12, backgroundColor: colors.systemGroupedBackground }}
		>
			<ScrollView
				ref={scroll}
				horizontal
				showsHorizontalScrollIndicator={false}
				onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
				contentContainerStyle={{
					flexGrow: 1,
					justifyContent: 'center',
					gap: 8,
					paddingHorizontal: 16
				}}
			>
				{options.map((option) => {
					const isSelected = option.value === selection;
					const tint = option.tint ?? accent;
					return (
						<Pressable
							key={option.value}
							onPress={() => onSelectionChange(option.value)}
							onLayout={(event) => frames.current.set(option.value, event.nativeEvent.layout)}
							accessibilityRole="tab"
							accessibilityLabel={option.title}
							accessibilityState={{ selected: isSelected }}
							android_ripple={{ color: colors.separator as string }}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 8,
								height: 32,
								paddingHorizontal: 12,
								borderRadius: 8,
								overflow: 'hidden',
								borderWidth: 1,
								borderColor: isSelected ? 'transparent' : m3.outline,
								backgroundColor: isSelected ? withOpacity(tint, 0.15) : 'transparent'
							}}
						>
							<Icon name={option.systemImage} size={18} color={tint} />
							<Text
								numberOfLines={1}
								style={[m3Type.labelLarge, { color: isSelected ? tint : colors.label }]}
							>
								{option.title}
							</Text>
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}
