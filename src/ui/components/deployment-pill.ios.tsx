/**
 * Port of `DeploymentPillView` (DeploymentPill.swift): the floating in-app
 * indicator for the active deployment, modeled on the toast capsule. A fixed
 * 50pt glass capsule; progress runs around its edge; a finished pill can be
 * flicked down to dismiss. Tap reopens the full-log sheet.
 *
 * Position it where `DeploymentPillHost` did: bottom-anchored above the tab
 * bar (60pt on iOS 26, 56 on 18), one slot higher while a toast shows.
 *
 * Standalone (RN wrapper + SwiftUI content + RN svg progress border).
 */
import { Host } from '@/ui/host';
import { Button, HStack, Spacer, Text, VStack, useNativeState } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	contentShape,
	contentTransition,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	padding,
	shapes,
	symbolEffect,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';

import { useReduceMotion } from './accessibility';
import { CapsuleProgressBorder } from './capsule-progress-border';
import { useCompletionSweep } from './deployment-pill.shared';
import {
	isTerminal,
	pillAccessibilityText,
	pillCaption,
	type DeploymentPillProps
} from './install-stream.types';
import { floatingSurfaceShadowStyle } from './surfaces';
import { glassEffectCompat, isIOS26 } from './swiftui-surfaces';

export function DeploymentPill({ operation, onTap, onDismiss }: DeploymentPillProps) {
	const accent = useAccentColor();
	const reduceMotion = useReduceMotion();
	const status = operation.status;
	const { completionFill, showsCheckmark } = useCompletionSweep(status, reduceMotion);
	const pulsing = useNativeState(status.kind === 'running');
	useEffect(() => {
		pulsing.value = status.kind === 'running';
	}, [pulsing, status.kind]);

	// Only a finished pill can be flicked away; a running indicator shouldn't vanish by accident.
	const terminal = isTerminal(status);
	const swipe = Gesture.Pan().onEnd((event) => {
		if (terminal && event.translationY > 30) scheduleOnRN(onDismiss);
	});

	const icon =
		status.kind === 'failure' ? (
			<Image
				systemName="xmark.octagon.fill"
				modifiers={[
					font({ textStyle: 'body', weight: 'semibold' }),
					foregroundStyle(systemColors.red)
				]}
			/>
		) : status.kind === 'success' && showsCheckmark ? (
			<Image
				systemName="checkmark.circle.fill"
				modifiers={[
					font({ textStyle: 'body', weight: 'semibold' }),
					foregroundStyle(systemColors.green)
				]}
			/>
		) : (
			<Image
				systemName={operation.systemImage as SFSymbol}
				modifiers={[
					font({ textStyle: 'body', weight: 'semibold' }),
					foregroundStyle(systemColors.blue),
					symbolEffect(
						{ effect: 'pulse' },
						{ options: { repeat: 'continuous' }, isActive: pulsing }
					)
				]}
			/>
		);

	return (
		<GestureDetector gesture={swipe}>
			<Animated.View
				entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
				exiting={FadeOut.duration(200)}
				style={{ paddingHorizontal: 15 }}
				accessible
				accessibilityRole="button"
				accessibilityLabel={pillAccessibilityText(operation)}
				accessibilityHint="Opens the full log"
			>
				<View
					style={[{ height: 50, borderRadius: 25 }, isIOS26 ? null : floatingSurfaceShadowStyle]}
				>
					<Host style={{ height: 50 }}>
						<Button
							onPress={onTap}
							modifiers={[buttonStyle('plain'), glassEffectCompat({ shape: 'capsule' })]}
						>
							<HStack
								spacing={10}
								modifiers={[
									padding({ horizontal: 16 }),
									frame({ maxWidth: Infinity, minHeight: 50, maxHeight: 50 }),
									contentShape(shapes.capsule())
								]}
							>
								{icon}
								<VStack alignment="leading" spacing={1}>
									<Text
										modifiers={[
											font({ textStyle: 'subheadline', weight: 'semibold' }),
											foregroundStyle('primary'),
											lineLimit(1),
											truncationMode('middle')
										]}
									>
										{operation.title}
									</Text>
									<Text
										modifiers={[
											font({ textStyle: 'caption2' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
											lineLimit(1),
											contentTransition('opacity')
										]}
									>
										{pillCaption(operation)}
									</Text>
								</VStack>
								<Spacer minLength={8} />
							</HStack>
						</Button>
					</Host>
					<CapsuleProgressBorder
						fraction={status.kind === 'running' ? operation.progressFraction : completionFill}
						isActive={status.kind === 'running'}
						tint={status.kind === 'success' ? systemColors.green : accent}
						animation={status.kind === 'success' ? Motion.completionSweep : Motion.gauge}
					/>
				</View>
			</Animated.View>
		</GestureDetector>
	);
}
