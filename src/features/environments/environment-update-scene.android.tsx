import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated';

import { EnvironmentUpdateResult } from '@/sdk/models/system/Upgrade';
import { useAccentColor } from '@/theme/accent';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { springConfig } from '@/theme/motion';
import { useReduceMotion } from '@/ui/components/accessibility';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	bubbleTint,
	EnvironmentUpdateBubblePhases,
	EnvironmentUpdateBubblePresentation,
	EnvironmentUpdateRingEnvironment,
	EnvironmentUpdateSceneKind,
	EnvironmentUpdateSceneModelHelpers as M,
	pipelineBubbleSize,
	pipelineConnectorFill,
	type EnvironmentUpdateSceneModel,
	type EnvironmentUpdateTint
} from './environment-update-scene.types';

const stageSpring = springConfig(0.68, 0.88);
const handoffSpring = springConfig(0.68, 0.94);

function useTintColor(): (tint: EnvironmentUpdateTint) => string {
	const accent = useAccentColor();
	return (tint) => (tint === 'accent' ? accent : systemColors[tint]);
}

export function EnvironmentUpdateScene({ model }: { model: EnvironmentUpdateSceneModel }) {
	const reduceMotion = useReduceMotion();
	const resolve = useTintColor();
	const tint = resolve(EnvironmentUpdateSceneKind.tint(model.kind));
	const isTerminal = EnvironmentUpdateSceneKind.isTerminal(model.kind);
	const showsPercentage = M.showsPercentage(model);
	const active = model.activeEnvironment;
	const activeID = active ? EnvironmentUpdateResult.id(active) : undefined;

	const appear = useSharedValue(0);
	useEffect(() => {
		appear.value = reduceMotion ? withTiming(1, { duration: 200 }) : withSpring(1, stageSpring);
	}, [appear, reduceMotion]);
	const appearStyle = useAnimatedStyle(() => ({
		opacity: appear.value,
		transform: [{ scale: reduceMotion ? 1 : 0.94 + 0.06 * appear.value }]
	}));

	const focusScale = useSharedValue(isTerminal ? 1.06 : 1);
	useEffect(() => {
		const target = isTerminal ? 1.06 : 1;
		focusScale.value = reduceMotion ? target : withSpring(target, stageSpring);
	}, [focusScale, isTerminal, reduceMotion]);
	const focusStyle = useAnimatedStyle(() => ({ transform: [{ scale: focusScale.value }] }));

	return (
		<Animated.View
			accessible
			accessibilityLabel={model.title}
			accessibilityValue={{ text: M.accessibilityValue(model) }}
			style={[
				{ width: '100%', minHeight: 248, paddingVertical: 4, alignItems: 'center', gap: 24 },
				appearStyle
			]}
		>
			<View
				pointerEvents="none"
				importantForAccessibility="no-hide-descendants"
				style={{
					position: 'absolute',
					top: 4 + 48 - 130,
					width: 260,
					height: 260,
					borderRadius: 130,
					backgroundColor: withOpacity(tint, 0.06)
				}}
			/>

			<Animated.View
				style={[
					{
						width: 96,
						height: 96,
						borderRadius: 48,
						backgroundColor: withOpacity(tint, isTerminal ? 0.16 : 0.1),
						borderWidth: 1,
						borderColor: withOpacity(tint, 0.2),
						alignItems: 'center',
						justifyContent: 'center'
					},
					focusStyle
				]}
			>
				{showsPercentage ? (
					<Text
						style={{ fontSize: 22, fontWeight: '600', color: tint, fontVariant: ['tabular-nums'] }}
					>
						{`${M.percentage(model)}%`}
					</Text>
				) : (
					<SpinningIcon
						name={EnvironmentUpdateSceneKind.symbol(model.kind)}
						color={tint}
						size={34}
						spins={!reduceMotion && (model.kind === 'starting' || model.kind === 'updating')}
					/>
				)}
			</Animated.View>

			{model.ringEnvironments.length > 0 ? (
				<EnvironmentUpdatePipeline
					environments={model.ringEnvironments}
					activeEnvironmentID={activeID}
					tint={EnvironmentUpdateSceneKind.tint(model.kind)}
				/>
			) : null}

			<View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
				<Text
					style={[
						m3Type.headlineSmall,
						{ color: colors.label, textAlign: 'center', fontWeight: '700' }
					]}
				>
					{model.title}
				</Text>
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
					{model.subtitle}
				</Text>

				{active && M.showsActiveEnvironment(model) ? (
					<View
						key={activeID}
						style={{
							marginTop: 6,
							flexDirection: 'row',
							alignItems: 'center',
							gap: 6,
							paddingHorizontal: 10,
							paddingVertical: 5,
							borderRadius: 999,
							backgroundColor: withOpacity(tint, 0.12),
							maxWidth: '100%'
						}}
					>
						<SpinningIcon
							name="arrow.triangle.2.circlepath"
							color={tint}
							size={13}
							spins={!reduceMotion}
						/>
						<Text
							numberOfLines={1}
							ellipsizeMode="middle"
							style={[m3Type.labelMedium, { color: tint, fontWeight: '600' }]}
						>
							{active.environmentName}
						</Text>
					</View>
				) : null}
			</View>
		</Animated.View>
	);
}

function SpinningIcon({
	name,
	color,
	size,
	spins
}: {
	name: string;
	color: string;
	size: number;
	spins: boolean;
}) {
	const rotation = useSharedValue(0);
	useEffect(() => {
		if (spins) {
			rotation.value = 0;
			rotation.value = withRepeat(
				withTiming(360, { duration: 1000, easing: Easing.linear }),
				-1,
				false
			);
		} else {
			cancelAnimation(rotation);
			rotation.value = 0;
		}
	}, [rotation, spins]);
	const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
	return (
		<Animated.View style={style}>
			<Icon name={name} color={color} size={size} />
		</Animated.View>
	);
}

function EnvironmentUpdatePipeline({
	environments,
	activeEnvironmentID,
	tint
}: {
	environments: EnvironmentUpdateRingEnvironment[];
	activeEnvironmentID: string | undefined;
	tint: EnvironmentUpdateTint;
}) {
	const size = pipelineBubbleSize(environments.length);
	return (
		<View
			importantForAccessibility="no-hide-descendants"
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				paddingHorizontal: 8,
				width: '100%',
				maxWidth: 420
			}}
		>
			{environments.flatMap((environment, index) => {
				const id = EnvironmentUpdateRingEnvironment.id(environment);
				const nodes = [
					<EnvironmentUpdateBubble
						key={`bubble-${id}`}
						environment={environment}
						index={index}
						isActive={id === activeEnvironmentID}
						tint={tint}
						size={size}
					/>
				];
				if (index < environments.length - 1) {
					nodes.push(
						<EnvironmentUpdateConnector
							key={`connector-${id}`}
							fill={pipelineConnectorFill(environment, activeEnvironmentID)}
							tint={tint}
						/>
					);
				}
				return nodes;
			})}
		</View>
	);
}

function EnvironmentUpdateConnector({ fill, tint }: { fill: number; tint: EnvironmentUpdateTint }) {
	const resolve = useTintColor();
	const progress = useSharedValue(fill);
	useEffect(() => {
		progress.value = withTiming(fill, {
			duration: 1350,
			easing: Easing.bezier(0.25, 0.1, 0.25, 1)
		});
	}, [progress, fill]);
	const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
	return (
		<View style={{ flex: 1, minWidth: 8, height: 3, marginHorizontal: 6 }}>
			<View
				style={{
					position: 'absolute',
					inset: 0,
					borderRadius: 2,
					backgroundColor: withOpacity(systemColors.gray, 0.16)
				}}
			/>
			<Animated.View
				style={[{ height: 3, borderRadius: 2, backgroundColor: resolve(tint) }, fillStyle]}
			/>
		</View>
	);
}

function EnvironmentUpdateBubble({
	environment,
	index,
	isActive,
	tint,
	size
}: {
	environment: EnvironmentUpdateRingEnvironment;
	index: number;
	isActive: boolean;
	tint: EnvironmentUpdateTint;
	size: number;
}) {
	const reduceMotion = useReduceMotion();
	const resolve = useTintColor();
	const isManager = environment.result.environmentId === '0';
	const presentation = EnvironmentUpdateBubblePresentation.fromStatus(environment.result.status);
	const presentationTerminal = EnvironmentUpdateBubblePresentation.isTerminal(presentation);
	const color = resolve(bubbleTint(presentation, tint));
	const symbol =
		EnvironmentUpdateBubblePresentation.terminalSymbol(presentation) ??
		(isManager ? 'crown.fill' : 'server.rack');
	const showsSpinner = isActive && presentation === 'updating';
	const emphasized = isActive || presentationTerminal;

	const floats = !reduceMotion && !presentationTerminal;
	const floatScale = isActive ? 1.6 : 0.8;
	const dx = useSharedValue(0);
	const dy = useSharedValue(0);
	useEffect(() => {
		if (!floats) {
			dx.value = withSpring(0, handoffSpring);
			dy.value = withSpring(0, handoffSpring);
			return;
		}
		const count = EnvironmentUpdateBubblePhases.length;
		const ordered = Array.from(
			{ length: count },
			(_, i) => EnvironmentUpdateBubblePhases[(index + 1 + i) % count]
		);
		const timing = { duration: 1800, easing: Easing.inOut(Easing.cubic) };
		dx.value = withRepeat(
			withSequence(...ordered.map((p) => withTiming((p?.x ?? 0) * floatScale * 0.4, timing))),
			-1,
			false
		);
		dy.value = withRepeat(
			withSequence(...ordered.map((p) => withTiming((p?.y ?? 0) * floatScale, timing))),
			-1,
			false
		);
	}, [dx, dy, floats, floatScale, index]);
	const floatStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: dx.value }, { translateY: dy.value }]
	}));

	const scale = useSharedValue(isActive ? 1.15 : 1);
	useEffect(() => {
		const target = isActive ? 1.15 : 1;
		scale.value = reduceMotion ? target : withSpring(target, handoffSpring);
	}, [scale, isActive, reduceMotion]);
	const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

	const rotation = useSharedValue(0);
	const spins = !reduceMotion && showsSpinner;
	useEffect(() => {
		if (spins) {
			rotation.value = 0;
			rotation.value = withRepeat(
				withTiming(360, { duration: 1450, easing: Easing.linear }),
				-1,
				false
			);
		} else {
			cancelAnimation(rotation);
			rotation.value = 0;
		}
	}, [rotation, spins]);
	const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

	const ring = size + 10;
	return (
		<Animated.View
			style={[
				{ width: size + 12, height: size + 12, alignItems: 'center', justifyContent: 'center' },
				floatStyle
			]}
		>
			{showsSpinner ? (
				<>
					<View
						style={{
							position: 'absolute',
							width: ring,
							height: ring,
							borderRadius: ring / 2,
							borderWidth: 2.5,
							borderColor: withOpacity(color, 0.18)
						}}
					/>
					<Animated.View
						style={[
							{
								position: 'absolute',
								width: ring,
								height: ring,
								borderRadius: ring / 2,
								borderWidth: 2.5,
								borderColor: 'transparent',
								borderTopColor: color,
								borderRightColor: color
							},
							spinStyle
						]}
					/>
				</>
			) : null}
			<Animated.View
				style={[
					{
						width: size,
						height: size,
						borderRadius: size / 2,
						backgroundColor: withOpacity(color, emphasized ? 0.2 : 0.1),
						borderWidth: 1,
						borderColor: withOpacity(color, emphasized ? 0.5 : 0.24),
						alignItems: 'center',
						justifyContent: 'center'
					},
					scaleStyle
				]}
			>
				<Icon
					name={symbol}
					color={color}
					size={Math.max(8, size * (presentationTerminal ? 0.44 : 0.4))}
				/>
			</Animated.View>
		</Animated.View>
	);
}
