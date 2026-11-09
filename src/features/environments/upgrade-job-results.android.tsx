import { useEffect, useRef } from 'react';
import { ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { m3Type, monoFamily } from '@/ui/components/type-scale';

import { resultLogs } from './upgrade-job-follow';
import type { UpgradeLogsProps } from './upgrade-job-results.types';

export function UpgradeLogs({ logs, maxHeight = 220 }: UpgradeLogsProps) {
	const text = resultLogs(logs);
	const scroll = useRef<ScrollViewInstance>(null);
	if (!text) {
		return <Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>No logs yet</Text>;
	}
	return (
		<ScrollView
			ref={scroll}
			nestedScrollEnabled
			onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
			style={{
				maxHeight,
				borderRadius: Radius.nested,
				backgroundColor: withOpacity(systemColors.gray, 0.12)
			}}
			contentContainerStyle={{ padding: 12 }}
		>
			<Text selectable style={{ fontFamily: monoFamily, fontSize: 11, color: colors.label }}>
				{text}
			</Text>
		</ScrollView>
	);
}

export function ProgressBar({ fraction, color }: { fraction: number; color: string }) {
	const value = useSharedValue(fraction);
	useEffect(() => {
		value.set(withTiming(fraction, { duration: 300 }));
	}, [value, fraction]);
	const fill = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));
	return (
		<View
			style={{
				flex: 1,
				height: 4,
				borderRadius: 2,
				overflow: 'hidden',
				backgroundColor: withOpacity(color, 0.24)
			}}
		>
			<Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: color }, fill]} />
		</View>
	);
}
