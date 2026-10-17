import {
	Background,
	Capsule,
	Circle,
	HStack,
	Text,
	VStack,
	ZStack,
	useNativeState
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	accessibilityValue,
	Animation,
	animation,
	background,
	blur,
	contentTransition,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	multilineTextAlignment,
	offset,
	onAppear,
	onGeometryChange,
	opacity,
	padding,
	rotationEffect,
	scaleEffect,
	shapes,
	strokeBorder,
	symbolEffect,
	truncationMode,
	type ChainableAnimationType,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { EnvironmentUpdateResult } from '@/sdk/models/system/Upgrade';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { useReduceMotion } from '@/ui/components/accessibility';
import { hashKey } from '@/ui/components/swiftui-motion';

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

const UpdateMotion = {
	state: () => Animation.smooth({ duration: 0.25 }),
	updateStage: () => Animation.spring({ response: 0.68, dampingFraction: 0.88 }),
	updateConnector: () => Animation.smooth({ duration: 1.35 }),
	updateBubbleSpinner: () => Animation.linear({ duration: 1.45 }),
	updateBubbleDrift: () => Animation.easeInOut({ duration: 1.8 }),
	updateBubbleHandoff: () => Animation.spring({ response: 0.68, dampingFraction: 0.94 }),
	reducedFallback: () => Animation.easeOut({ duration: 0.2 })
};

function aware(
	anim: ChainableAnimationType,
	value: number | boolean,
	reduceMotion: boolean
): ModifierConfig[] {
	return reduceMotion ? [] : [animation(anim, value)];
}

function useTintColor(): (tint: EnvironmentUpdateTint) => string {
	const accent = useAccentColor();
	return (tint) => (tint === 'accent' ? accent : systemColors[tint]);
}

function useActiveState(active: boolean) {
	const state = useNativeState<boolean>(active);
	useEffect(() => {
		state.value = active;
	}, [state, active]);
	return state;
}

function useTriggerState(trigger: number | string) {
	const state = useNativeState<number | string>(trigger);
	useEffect(() => {
		state.value = trigger;
	}, [state, trigger]);
	return state;
}

export function EnvironmentUpdateScene({ model }: { model: EnvironmentUpdateSceneModel }) {
	const reduceMotion = useReduceMotion();
	const resolve = useTintColor();
	const tint = resolve(EnvironmentUpdateSceneKind.tint(model.kind));
	const isTerminal = EnvironmentUpdateSceneKind.isTerminal(model.kind);
	const [hasAppeared, setHasAppeared] = useState(false);
	const [completionPulse, setCompletionPulse] = useState(0);

	const lastKind = useRef(model.kind);
	useEffect(() => {
		if (lastKind.current !== model.kind) {
			lastKind.current = model.kind;
			if (EnvironmentUpdateSceneKind.isTerminal(model.kind)) setCompletionPulse((n) => n + 1);
		}
	}, [model.kind]);

	const active = model.activeEnvironment;
	const activeID = active ? EnvironmentUpdateResult.id(active) : undefined;
	const spinActive = useActiveState(!reduceMotion);

	return (
		<Background
			modifiers={[
				opacity(hasAppeared ? 1 : 0),
				scaleEffect(reduceMotion || hasAppeared ? 1 : 0.94),
				animation(
					reduceMotion ? UpdateMotion.reducedFallback() : UpdateMotion.updateStage(),
					hasAppeared
				),
				...aware(UpdateMotion.updateStage(), hashKey(model.kind), reduceMotion),
				...aware(UpdateMotion.updateStage(), hashKey(model.title), reduceMotion),
				...aware(UpdateMotion.updateStage(), hashKey(activeID ?? ''), reduceMotion),
				accessibilityElement('ignore'),
				accessibilityLabel(model.title),
				accessibilityValue(M.accessibilityValue(model)),
				onAppear(() => {
					setHasAppeared(true);
					if (isTerminal) setCompletionPulse((n) => n + 1);
				})
			]}
		>
			<VStack
				spacing={24}
				modifiers={[frame({ maxWidth: Infinity, minHeight: 248 }), padding({ vertical: 4 })]}
			>
				<SceneFocus model={model} tint={tint} completionPulse={completionPulse} />

				{model.ringEnvironments.length > 0 ? (
					<EnvironmentUpdatePipeline
						environments={model.ringEnvironments}
						activeEnvironmentID={activeID}
						tint={EnvironmentUpdateSceneKind.tint(model.kind)}
					/>
				) : null}

				<VStack spacing={6}>
					<Text
						modifiers={[
							font({ textStyle: 'title', weight: 'bold' }),
							multilineTextAlignment('center'),
							contentTransition('interpolate')
						]}
					>
						{model.title}
					</Text>

					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							multilineTextAlignment('center'),
							fixedSize({ horizontal: false, vertical: true }),
							contentTransition('interpolate'),
							...aware(UpdateMotion.state(), hashKey(model.subtitle), reduceMotion)
						]}
					>
						{model.subtitle}
					</Text>

					{active && M.showsActiveEnvironment(model) ? (
						<HStack
							key={activeID}
							spacing={6}
							modifiers={[
								foregroundStyle(tint),
								padding({ horizontal: 10, vertical: 5 }),
								background(withOpacity(tint, 0.12), shapes.capsule()),
								padding({ top: 6 })
							]}
						>
							<Image
								systemName="arrow.triangle.2.circlepath"
								modifiers={[
									font({ textStyle: 'caption', weight: 'semibold' }),
									symbolEffect({ effect: 'rotate' }, { isActive: spinActive })
								]}
							/>
							<Text
								modifiers={[
									font({ textStyle: 'caption', weight: 'semibold' }),
									lineLimit(1),
									truncationMode('middle')
								]}
							>
								{active.environmentName}
							</Text>
						</HStack>
					) : null}
				</VStack>
			</VStack>
			<Background.Content>
				<Circle
					modifiers={[
						foregroundStyle({
							type: 'radialGradient',
							colors: [withOpacity(tint, 0.12), withOpacity(tint, 0.03), withOpacity(tint, 0)],
							center: { x: 0.5, y: 0.5 },
							startRadius: 0,
							endRadius: 120
						}),
						frame({ width: 260, height: 260 }),
						blur(10),
						offset({ y: -40 }),
						accessibilityHidden(true)
					]}
				/>
			</Background.Content>
		</Background>
	);
}

function SceneFocus({
	model,
	tint,
	completionPulse
}: {
	model: EnvironmentUpdateSceneModel;
	tint: string;
	completionPulse: number;
}) {
	const reduceMotion = useReduceMotion();
	const isTerminal = EnvironmentUpdateSceneKind.isTerminal(model.kind);
	const showsPercentage = M.showsPercentage(model);
	const percentage = M.percentage(model);
	const focusSize = 96;

	return (
		<ZStack
			modifiers={[
				frame({ width: focusSize, height: focusSize }),
				scaleEffect(isTerminal ? 1.06 : 1),
				...aware(UpdateMotion.updateStage(), showsPercentage, reduceMotion),
				...aware(UpdateMotion.updateStage(), isTerminal, reduceMotion)
			]}
		>
			<Circle modifiers={[foregroundStyle(withOpacity(tint, isTerminal ? 0.16 : 0.1))]} />
			<Circle
				modifiers={[
					foregroundStyle('#00000000'),
					strokeBorder({
						content: withOpacity(tint, 0.2),
						style: { lineWidth: 1 },
						shape: 'circle'
					})
				]}
			/>

			<AnimatedSymbol
				model={model}
				tint={tint}
				completionPulse={completionPulse}
				showsPercentage={showsPercentage}
			/>

			<Text
				modifiers={[
					font({ textStyle: 'title2', design: 'rounded', weight: 'semibold' }),
					foregroundStyle(tint),
					contentTransition('numericText'),
					opacity(showsPercentage ? 1 : 0),
					scaleEffect(showsPercentage ? 1 : 0.82),
					...aware(UpdateMotion.updateStage(), percentage, reduceMotion)
				]}
			>
				{`${percentage}%`}
			</Text>
		</ZStack>
	);
}

function AnimatedSymbol({
	model,
	tint,
	completionPulse,
	showsPercentage
}: {
	model: EnvironmentUpdateSceneModel;
	tint: string;
	completionPulse: number;
	showsPercentage: boolean;
}) {
	const reduceMotion = useReduceMotion();
	const effectActive = useActiveState(!reduceMotion);
	const pulse = useTriggerState(completionPulse);

	const effect: ModifierConfig[] = (() => {
		switch (model.kind) {
			case 'loading':
			case 'restarting':
				return [
					symbolEffect(
						{ effect: 'variableColor', fillStyle: 'iterative' },
						{ options: { repeat: 'continuous' }, isActive: effectActive }
					)
				];
			case 'starting':
				return [symbolEffect({ effect: 'rotate' }, { isActive: effectActive })];
			case 'updating':
				return showsPercentage
					? []
					: [symbolEffect({ effect: 'rotate' }, { isActive: effectActive })];
			case 'reconnecting':
				return [
					symbolEffect(
						{ effect: 'variableColor', fillStyle: 'iterative', playbackStyle: 'reversing' },
						{ options: { repeat: 'continuous' }, isActive: effectActive }
					)
				];
			case 'completed':
			case 'warning':
			case 'failed':
				return reduceMotion
					? []
					: [
							symbolEffect(
								{ effect: 'bounce' },
								{ options: { repeat: 'nonRepeating' }, value: pulse }
							)
						];
			case 'ready':
				return [];
		}
	})();

	return (
		<Image
			key={model.kind}
			systemName={EnvironmentUpdateSceneKind.symbol(model.kind) as SFSymbol}
			modifiers={[
				font({ textStyle: 'largeTitle', design: 'rounded', weight: 'semibold' }),
				foregroundStyle(tint),
				...effect,
				opacity(showsPercentage ? 0 : 1),
				scaleEffect(showsPercentage ? 0.82 : 1)
			]}
		/>
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
		<HStack
			spacing={0}
			modifiers={[padding({ horizontal: 8 }), frame({ maxWidth: 420 }), accessibilityHidden(true)]}
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
		</HStack>
	);
}

function EnvironmentUpdateConnector({ fill, tint }: { fill: number; tint: EnvironmentUpdateTint }) {
	const resolve = useTintColor();
	const [width, setWidth] = useState(0);
	return (
		<ZStack
			alignment="leading"
			modifiers={[
				frame({ height: 3 }),
				frame({ minWidth: 8, maxWidth: Infinity }),
				onGeometryChange((f) => setWidth(f.width)),
				padding({ horizontal: 6 })
			]}
		>
			<Capsule
				modifiers={[
					foregroundStyle(withOpacity(systemColors.gray, 0.16)),
					frame({ maxWidth: Infinity, minHeight: 3, maxHeight: 3 })
				]}
			/>
			<Capsule
				modifiers={[
					foregroundStyle(resolve(tint)),
					frame({ width: Math.max(0, width * fill), height: 3 }),
					animation(UpdateMotion.updateConnector(), fill)
				]}
			/>
		</ZStack>
	);
}

function spinnerArcColors(color: string): string[] {
	const stops = 50;
	const clear = withOpacity(color, 0);
	return Array.from({ length: stops + 1 }, (_, i) => {
		const t = i / stops;
		return t >= 0.08 && t <= 0.72 ? color : clear;
	});
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
	const [phaseStep, setPhaseStep] = useState(0);
	useEffect(() => {
		if (!floats) {
			setPhaseStep(0);
			return;
		}
		setPhaseStep(1);
		const timer = setInterval(() => setPhaseStep((s) => s + 1), 1800);
		return () => clearInterval(timer);
	}, [floats]);
	const phaseCount = EnvironmentUpdateBubblePhases.length;
	const phase = floats
		? EnvironmentUpdateBubblePhases[(index + phaseStep) % phaseCount]
		: EnvironmentUpdateBubblePhases[0];
	const floatScale = isActive ? 1.6 : 0.8;

	const spins = !reduceMotion && showsSpinner;
	const [rotation, setRotation] = useState(0);
	useEffect(() => {
		if (!spins) {
			setRotation(0);
			return;
		}
		setRotation(360);
	}, [spins]);

	const bounceValue = useTriggerState(reduceMotion ? 'pending' : presentation);

	return (
		<ZStack
			modifiers={[
				frame({ width: size + 12, height: size + 12 }),
				offset({ x: (phase?.x ?? 0) * floatScale * 0.4, y: (phase?.y ?? 0) * floatScale }),
				animation(UpdateMotion.updateBubbleDrift(), phaseStep),
				...aware(UpdateMotion.updateBubbleHandoff(), hashKey(presentation), reduceMotion),
				...aware(UpdateMotion.updateBubbleHandoff(), isActive, reduceMotion)
			]}
		>
			<Circle
				modifiers={[
					foregroundStyle('#00000000'),
					strokeBorder({
						content: withOpacity(color, 0.18),
						style: { lineWidth: 2.5 },
						shape: 'circle'
					}),
					frame({ width: size + 10, height: size + 10 }),
					opacity(showsSpinner ? 1 : 0),
					scaleEffect(showsSpinner ? 1 : 0.85)
				]}
			/>

			<Circle
				modifiers={[
					foregroundStyle('#00000000'),
					strokeBorder({
						content: {
							type: 'angularGradient',
							colors: spinnerArcColors(color),
							center: { x: 0.5, y: 0.5 }
						},
						style: { lineWidth: 2.5, lineCap: 'round' },
						shape: 'circle'
					}),
					frame({ width: size + 10, height: size + 10 }),
					opacity(showsSpinner ? 1 : 0),
					scaleEffect(showsSpinner ? 1 : 0.85),
					rotationEffect(rotation),
					animation(
						spins
							? UpdateMotion.updateBubbleSpinner().repeat({
									repeatCount: 100000,
									autoreverses: false
								})
							: UpdateMotion.reducedFallback(),
						rotation
					)
				]}
			/>

			<ZStack modifiers={[frame({ width: size, height: size }), scaleEffect(isActive ? 1.15 : 1)]}>
				<Circle modifiers={[foregroundStyle(withOpacity(color, emphasized ? 0.2 : 0.1))]} />
				<Circle
					modifiers={[
						foregroundStyle('#00000000'),
						strokeBorder({
							content: withOpacity(color, emphasized ? 0.5 : 0.24),
							style: { lineWidth: 1 },
							shape: 'circle'
						})
					]}
				/>
				<Image
					key={symbol}
					systemName={symbol as SFSymbol}
					modifiers={[
						font({
							size: Math.max(8, size * (presentationTerminal ? 0.44 : 0.4)),
							weight: 'semibold'
						}),
						foregroundStyle(color),
						symbolEffect(
							{ effect: 'bounce' },
							{ options: { repeat: 'nonRepeating' }, value: bounceValue }
						)
					]}
				/>
			</ZStack>
		</ZStack>
	);
}
