import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

import { useReduceMotion } from '../accessibility';
import { m3 } from '../material-colors';
import { animateTo } from '../motion-views';
import { exitDelay, type DeleteConfirmationCardProps } from './card.types';

function TextButton({
	title,
	color,
	onPress
}: {
	title: string;
	color: unknown;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string, borderless: false }}
			style={{
				minHeight: 40,
				paddingHorizontal: 12,
				justifyContent: 'center',
				borderRadius: 20,
				overflow: 'hidden'
			}}
		>
			<Text
				numberOfLines={1}
				style={{ color: color as string, fontSize: 14, fontWeight: '500', letterSpacing: 0.1 }}
			>
				{title}
			</Text>
		</Pressable>
	);
}

export function DeleteConfirmationCard({ config, onResolved }: DeleteConfirmationCardProps) {
	const reduceMotion = useReduceMotion();
	const accent = useAccentColor();
	const shown = useSharedValue(0);
	const isDismissing = useRef(false);
	const motion = reduceMotion ? Motion.reducedFallback : Motion.overlay;

	useEffect(() => {
		void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
		shown.set(animateTo(motion, 1));
	}, [motion, shown]);

	const resolve = (action: (() => void) | undefined) => {
		if (isDismissing.current) return;
		isDismissing.current = true;
		if (action) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		shown.set(animateTo(motion, 0));
		setTimeout(() => onResolved(action), exitDelay(reduceMotion));
	};

	const scrimStyle = useAnimatedStyle(() => ({ opacity: shown.value * 0.4 }));
	const dialogStyle = useAnimatedStyle(() => ({
		opacity: Math.min(shown.value, 1),
		transform: [{ scale: reduceMotion ? 1 : interpolate(shown.value, [0, 1], [0.94, 1]) }]
	}));

	const cancel = (
		<TextButton
			key="cancel"
			title={config.cancelTitle ?? 'Cancel'}
			color={m3.primary}
			onPress={() => resolve(undefined)}
		/>
	);
	const actions = config.actions.map((action, index) => (
		<TextButton
			key={`action-${index}`}
			title={action.title}
			color={action.tint ?? ((action.role ?? 'destructive') === 'destructive' ? m3.error : accent)}
			onPress={() => resolve(action.action)}
		/>
	));

	return (
		<View style={StyleSheet.absoluteFill}>
			<Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrimStyle]}>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={() => resolve(undefined)}
					accessibilityLabel={config.cancelTitle ?? 'Cancel'}
				/>
			</Animated.View>
			<View
				pointerEvents="box-none"
				style={[
					StyleSheet.absoluteFill,
					{ justifyContent: 'center', alignItems: 'center', padding: 24 }
				]}
			>
				<Animated.View
					accessibilityViewIsModal
					style={[
						{
							width: '100%',
							maxWidth: 560,
							minWidth: 280,
							borderRadius: 28,
							padding: 24,
							backgroundColor: m3.surfaceContainerHigh,
							elevation: 6
						},
						dialogStyle
					]}
				>
					{config.icon !== null ? (
						<View style={{ alignItems: 'center', marginBottom: 16 }}>
							<Icon name={config.icon ?? 'exclamationmark.triangle'} size={24} color={m3.error} />
						</View>
					) : null}
					<Text style={{ color: colors.label, fontSize: 24, lineHeight: 32, textAlign: 'center' }}>
						{config.title}
					</Text>
					{config.message ? (
						<Text
							style={{
								color: m3.onSurfaceVariant,
								fontSize: 14,
								lineHeight: 20,
								letterSpacing: 0.25,
								marginTop: 16,
								textAlign: 'center'
							}}
						>
							{config.message}
						</Text>
					) : null}
					{config.actions.length <= 1 ? (
						<View
							style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}
						>
							{cancel}
							{actions}
						</View>
					) : (
						<View style={{ alignItems: 'flex-end', gap: 8, marginTop: 24 }}>
							{actions}
							{cancel}
						</View>
					)}
				</Animated.View>
			</View>
		</View>
	);
}
