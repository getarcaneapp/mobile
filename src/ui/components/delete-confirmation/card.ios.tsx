import { Host } from '@/ui/host';
import { Button, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	animation,
	background,
	blur,
	buttonStyle,
	controlSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	minimumScaleFactor,
	multilineTextAlignment,
	fixedSize,
	opacity,
	padding,
	scaleEffect,
	shapes,
	strokeBorder,
	tint
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { colorGradient, colors, systemColors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';

import { useReduceMotion } from '../accessibility';
import { animateTo } from '../motion-views';
import { swiftAnimation } from '../swiftui-motion';
import { floatingSurfaceShadow, isIOS26 } from '../swiftui-surfaces';
import { exitDelay, type DeleteConfirmationCardProps } from './card.types';
import type { DeleteConfirmationAction } from './presenter';
import { symbolRenderingMode } from '../../../../modules/arcane-swiftui-extras';

const cornerRadius = 40;

export function DeleteConfirmationCard({ config, onResolved }: DeleteConfirmationCardProps) {
	const reduceMotion = useReduceMotion();
	const accent = useAccentColor();
	const [shown, setShown] = useState(false);
	const isDismissing = useRef(false);
	const scrim = useSharedValue(0);
	const motion = reduceMotion ? Motion.reducedFallback : Motion.overlay;

	useEffect(() => {
		void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
		setShown(true);
		scrim.set(animateTo(motion, 1));
	}, [motion, scrim]);

	const resolve = (action: (() => void) | undefined) => {
		if (isDismissing.current) return;
		isDismissing.current = true;
		if (action) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		setShown(false);
		scrim.set(animateTo(motion, 0));
		setTimeout(() => onResolved(action), exitDelay(reduceMotion));
	};

	const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value * 0.4 }));
	const entrance = reduceMotion
		? swiftAnimation(Motion.reducedFallback)
		: swiftAnimation(Motion.overlay);
	const capsule = shapes.capsule();

	const label = (title: string, color?: string) => (
		<Text
			modifiers={[
				font({ weight: 'semibold' }),
				lineLimit(1),
				minimumScaleFactor(0.75),
				...(color ? [foregroundStyle(color)] : []),
				frame({ maxWidth: Infinity }),
				padding({ vertical: isIOS26 ? 4 : 12 }),
				...(isIOS26 ? [] : [background('#8E8E9340', capsule)])
			]}
		>
			{title}
		</Text>
	);

	const cancelButton = (
		<Button
			key="cancel"
			onPress={() => resolve(undefined)}
			modifiers={isIOS26 ? [buttonStyle('glass'), controlSize('large')] : [buttonStyle('plain')]}
		>
			{label(config.cancelTitle ?? 'Cancel', isIOS26 ? undefined : 'primary')}
		</Button>
	);

	const actionButton = (action: DeleteConfirmationAction, index: number) => {
		const fill =
			action.tint ?? ((action.role ?? 'destructive') === 'destructive' ? systemColors.red : accent);
		return (
			<Button
				key={`action-${index}`}
				onPress={() => resolve(action.action)}
				modifiers={
					isIOS26
						? [buttonStyle('glassProminent'), controlSize('large'), tint(fill)]
						: [buttonStyle('plain'), background(colorGradient(fill), capsule)]
				}
			>
				{isIOS26 ? (
					label(action.title)
				) : (
					<Text
						modifiers={[
							font({ weight: 'semibold' }),
							lineLimit(1),
							minimumScaleFactor(0.75),
							foregroundStyle('white'),
							frame({ maxWidth: Infinity }),
							padding({ vertical: 12 })
						]}
					>
						{action.title}
					</Text>
				)}
			</Button>
		);
	};

	const buttons =
		config.actions.length <= 1 ? (
			<HStack spacing={8}>
				{cancelButton}
				{config.actions.map(actionButton)}
			</HStack>
		) : (
			<VStack spacing={8}>
				{config.actions.map(actionButton)}
				{cancelButton}
			</VStack>
		);

	return (
		<View style={StyleSheet.absoluteFill}>
			<Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrimStyle]}>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={() => resolve(undefined)}
					accessibilityLabel={config.cancelTitle ?? 'Cancel'}
					accessibilityRole="button"
				/>
			</Animated.View>
			<View
				pointerEvents="box-none"
				style={[
					StyleSheet.absoluteFill,
					{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }
				]}
			>
				<View accessibilityViewIsModal style={{ width: '100%', maxWidth: 500 }}>
					<Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
						<VStack
							spacing={16}
							modifiers={[
								padding({ all: 20 }),
								background(
									colors.systemBackground,
									shapes.roundedRectangle({ cornerRadius, roundedCornerStyle: 'continuous' })
								),
								strokeBorder({
									color: '#8080800F',
									style: { lineWidth: 0.5 },
									shape: 'roundedRectangle',
									cornerRadius
								}),
								floatingSurfaceShadow(),
								scaleEffect(shown || reduceMotion ? 1 : 0.94),
								opacity(shown ? 1 : 0),
								blur(shown || reduceMotion ? 0 : 12),
								animation(entrance, shown)
							]}
						>
							<VStack spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
								{config.icon !== null ? (
									<Image
										systemName={(config.icon ?? 'exclamationmark.triangle') as SFSymbol}
										modifiers={[
											font({ size: 32, weight: 'semibold' }),
											symbolRenderingMode('hierarchical'),
											foregroundStyle(systemColors.red)
										]}
									/>
								) : null}
								<Text
									modifiers={[
										font({ textStyle: 'title3', weight: 'bold' }),
										multilineTextAlignment('center'),
										fixedSize({ horizontal: false, vertical: true })
									]}
								>
									{config.title}
								</Text>
								{config.message ? (
									<Text
										modifiers={[
											font({ textStyle: 'subheadline' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
											multilineTextAlignment('center'),
											fixedSize({ horizontal: false, vertical: true })
										]}
									>
										{config.message}
									</Text>
								) : null}
							</VStack>
							{buttons}
						</VStack>
					</Host>
				</View>
			</View>
		</View>
	);
}
