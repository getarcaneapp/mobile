/**
 * Port of `DeploymentPillView` (Android): the same floating capsule as a
 * Material 3 elevated surface with the progress border, caption, pulse and
 * swipe-down-to-dismiss for finished operations.
 *
 * Standalone (RN view).
 */
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	FadeIn,
	FadeOut,
	ReduceMotion,
	ZoomIn,
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAccentColor } from '@/theme/accent';
import { colors, systemColors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

import { useReduceMotion } from './accessibility';
import { CapsuleProgressBorder } from './capsule-progress-border';
import { useCompletionSweep } from './deployment-pill.shared';
import {
	isTerminal,
	pillAccessibilityText,
	pillCaption,
	type DeploymentPillProps
} from './install-stream.types';
import { m3 } from './material-colors';
import { m3Type } from './type-scale';

export function DeploymentPill({ operation, onTap, onDismiss }: DeploymentPillProps) {
	const accent = useAccentColor();
	const reduceMotion = useReduceMotion();
	const status = operation.status;
	const { completionFill, showsCheckmark } = useCompletionSweep(status, reduceMotion);
	const pulse = useSharedValue(1);
	const running = status.kind === 'running';

	useEffect(() => {
		if (running && !reduceMotion)
			pulse.value = withRepeat(withTiming(0.35, { duration: 800 }), -1, true);
		else {
			cancelAnimation(pulse);
			pulse.value = 1;
		}
	}, [running, reduceMotion, pulse]);
	const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

	const terminal = isTerminal(status);
	const swipe = Gesture.Pan().onEnd((event) => {
		if (terminal && event.translationY > 30) scheduleOnRN(onDismiss);
	});

	return (
		<GestureDetector gesture={swipe}>
			<Animated.View
				entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
				exiting={FadeOut.duration(200)}
				style={{ paddingHorizontal: 15 }}
			>
				<Pressable
					onPress={onTap}
					accessibilityRole="button"
					accessibilityLabel={pillAccessibilityText(operation)}
					accessibilityHint="Opens the full log"
					android_ripple={{ color: colors.separator as string }}
					style={{
						height: 50,
						borderRadius: 25,
						overflow: 'hidden',
						flexDirection: 'row',
						alignItems: 'center',
						gap: 10,
						paddingHorizontal: 16,
						backgroundColor: m3.surfaceContainerHigh,
						elevation: 3
					}}
				>
					{status.kind === 'failure' ? (
						<Icon name="xmark.octagon.fill" size={20} color={systemColors.red} />
					) : status.kind === 'success' && showsCheckmark ? (
						<Animated.View entering={reduceMotion ? undefined : ZoomIn.springify()}>
							<Icon name="checkmark.circle.fill" size={20} color={systemColors.green} />
						</Animated.View>
					) : (
						<Animated.View style={pulseStyle}>
							<Icon name={operation.systemImage} size={20} color={systemColors.blue} />
						</Animated.View>
					)}
					<View style={{ flex: 1, gap: 1 }}>
						<Text
							numberOfLines={1}
							ellipsizeMode="middle"
							style={[m3Type.titleSmall, { color: colors.label }]}
						>
							{operation.title}
						</Text>
						<Text
							numberOfLines={1}
							style={[m3Type.labelSmall, { fontWeight: '400', color: colors.secondaryLabel }]}
						>
							{pillCaption(operation)}
						</Text>
					</View>
					<CapsuleProgressBorder
						fraction={running ? operation.progressFraction : completionFill}
						isActive={running}
						tint={status.kind === 'success' ? systemColors.green : accent}
						animation={status.kind === 'success' ? Motion.completionSweep : Motion.gauge}
					/>
				</Pressable>
			</Animated.View>
		</GestureDetector>
	);
}
