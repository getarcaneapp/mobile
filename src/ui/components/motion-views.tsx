import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import {
	Pressable,
	type PressableProps,
	type StyleProp,
	type ViewStyle,
	type LayoutChangeEvent
} from 'react-native';
import Animated, {
	interpolate,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSpring,
	withTiming,
	type AnimatedScrollViewProps,
	type SharedValue
} from 'react-native-reanimated';

import { springConfig, timingConfig } from '@/theme/motion';
import { Motion, type MotionToken } from '@/theme/tokens';

import { useReduceMotion } from './accessibility';

export function animateTo(token: MotionToken, value: number, delayMs = 0) {
	const animation =
		token.type === 'spring'
			? withSpring(value, springConfig(token.response, token.dampingFraction))
			: withTiming(value, timingConfig(token));
	return delayMs > 0 ? withDelay(delayMs, animation) : animation;
}

export const seenEntranceIdentities = new Set<string>();

type EntranceProps = {
	id: string;
	index?: number;
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
};

export function CardEntranceView({ id, index = 0, children, style }: EntranceProps) {
	const reduceMotion = useReduceMotion();
	const [alreadyPlayed] = useState(() => seenEntranceIdentities.has(id));
	const progress = useSharedValue(alreadyPlayed ? 1 : 0);

	useEffect(() => {
		if (seenEntranceIdentities.has(id) && alreadyPlayed) return;
		seenEntranceIdentities.add(id);
		progress.value = reduceMotion
			? animateTo(Motion.reducedFallback, 1)
			: animateTo(Motion.entrance, 1, index * Motion.stagger);
	}, [id, index, reduceMotion, alreadyPlayed, progress]);

	const animated = useAnimatedStyle(() => ({
		opacity: Math.min(progress.value, 1),
		transform: [{ scale: reduceMotion ? 1 : interpolate(progress.value, [0, 1], [0.97, 1]) }]
	}));
	return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export function StaggeredRevealView({
	index,
	children,
	style
}: Omit<EntranceProps, 'id'> & { index: number }) {
	const reduceMotion = useReduceMotion();
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = reduceMotion
			? animateTo(Motion.reducedFallback, 1)
			: animateTo(Motion.entrance, 1, index * Motion.stagger);
	}, [index, reduceMotion, progress]);

	const animated = useAnimatedStyle(() => ({
		opacity: Math.min(progress.value, 1),
		transform: [{ translateY: reduceMotion ? 0 : interpolate(progress.value, [0, 1], [6, 0]) }]
	}));
	return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

type ScrollEdgeContext = { scrollY: SharedValue<number>; viewportHeight: SharedValue<number> };
const ScrollEdgeFadeContext = createContext<ScrollEdgeContext | null>(null);

export function ScrollEdgeFadeScrollView({
	children,
	onLayout,
	...rest
}: AnimatedScrollViewProps & { children: ReactNode }) {
	const scrollY = useSharedValue(0);
	const viewportHeight = useSharedValue(0);
	const onScroll = useAnimatedScrollHandler((event) => {
		scrollY.value = event.contentOffset.y;
	});
	return (
		<ScrollEdgeFadeContext value={{ scrollY, viewportHeight }}>
			<Animated.ScrollView
				{...rest}
				onScroll={onScroll}
				scrollEventThrottle={16}
				onLayout={(event: LayoutChangeEvent) => {
					viewportHeight.value = event.nativeEvent.layout.height;
					if (typeof onLayout === 'function') onLayout(event);
				}}
			>
				{children}
			</Animated.ScrollView>
		</ScrollEdgeFadeContext>
	);
}

export function ScrollEdgeFade({
	scales = true,
	children,
	style
}: {
	scales?: boolean;
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
}) {
	const context = use(ScrollEdgeFadeContext);
	const reduceMotion = useReduceMotion();
	const top = useSharedValue(0);
	const height = useSharedValue(0);
	const fallbackScroll = useSharedValue(0);
	const fallbackViewport = useSharedValue(0);
	const scrollY = context?.scrollY ?? fallbackScroll;
	const viewport = context?.viewportHeight ?? fallbackViewport;
	const shouldScale = scales && !reduceMotion;

	const animated = useAnimatedStyle(() => {
		if (height.value <= 0 || viewport.value <= 0) return { opacity: 1, transform: [{ scale: 1 }] };
		const visibleTop = top.value - scrollY.value;
		const visibleBottom = visibleTop + height.value;
		const overTop = Math.max(0, -visibleTop);
		const overBottom = Math.max(0, visibleBottom - viewport.value);
		const phase = Math.min(Math.max(overTop, overBottom) / height.value, 1);
		return {
			opacity: 1 - 0.45 * phase,
			transform: [{ scale: shouldScale ? 1 - 0.03 * phase : 1 }]
		};
	});

	return (
		<Animated.View
			style={[style, animated]}
			onLayout={(event) => {
				top.value = event.nativeEvent.layout.y;
				height.value = event.nativeEvent.layout.height;
			}}
		>
			{children}
		</Animated.View>
	);
}

export function LoadingCrossfadeView({
	showSkeleton,
	animatesTransition = true,
	skeleton,
	children,
	style
}: {
	showSkeleton: boolean;
	animatesTransition?: boolean;
	skeleton: ReactNode;
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
}) {
	const reduceMotion = useReduceMotion();
	const progress = useSharedValue(showSkeleton ? 0 : 1);
	const [rendered, setRendered] = useState({ skeleton: showSkeleton, content: !showSkeleton });
	const first = useRef(true);

	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		const target = showSkeleton ? 0 : 1;
		setRendered({ skeleton: true, content: true });
		if (!animatesTransition || reduceMotion) {
			progress.value = target;
			setRendered({ skeleton: showSkeleton, content: !showSkeleton });
			return;
		}
		progress.value = animateTo(Motion.state, target);
		const timer = setTimeout(
			() => setRendered({ skeleton: showSkeleton, content: !showSkeleton }),
			Motion.state.duration
		);
		return () => clearTimeout(timer);
	}, [showSkeleton, animatesTransition, reduceMotion, progress]);

	const skeletonStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
	const contentStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

	if (!animatesTransition) return <>{showSkeleton ? skeleton : children}</>;
	return (
		<Animated.View style={[{ flex: 1 }, style]}>
			{rendered.content ? (
				<Animated.View style={[{ flex: 1 }, contentStyle]}>{children}</Animated.View>
			) : null}
			{rendered.skeleton ? (
				<Animated.View
					pointerEvents={showSkeleton ? 'auto' : 'none'}
					style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, skeletonStyle]}
				>
					{skeleton}
				</Animated.View>
			) : null}
		</Animated.View>
	);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
	style,
	onPressIn,
	onPressOut,
	...rest
}: PressableProps & { style?: StyleProp<ViewStyle> }) {
	const reduceMotion = useReduceMotion();
	const pressed = useSharedValue(0);
	const animated = useAnimatedStyle(() => ({
		opacity: interpolate(pressed.value, [0, 1], [1, 0.8]),
		transform: [{ scale: reduceMotion ? 1 : interpolate(pressed.value, [0, 1], [1, 0.94]) }]
	}));
	return (
		<AnimatedPressable
			{...rest}
			style={[style, animated]}
			onPressIn={(event) => {
				pressed.set(reduceMotion ? 1 : animateTo(Motion.press, 1));
				onPressIn?.(event);
			}}
			onPressOut={(event) => {
				pressed.set(reduceMotion ? 0 : animateTo(Motion.press, 0));
				onPressOut?.(event);
			}}
		/>
	);
}

export function CardRowPressable({
	style,
	onPressIn,
	onPressOut,
	...rest
}: PressableProps & { style?: StyleProp<ViewStyle> }) {
	const pressed = useSharedValue(0);
	const animated = useAnimatedStyle(() => ({
		opacity: interpolate(pressed.value, [0, 1], [1, 0.65]),
		transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.99]) }]
	}));
	return (
		<AnimatedPressable
			{...rest}
			style={[style, animated]}
			onPressIn={(event) => {
				pressed.set(animateTo(Motion.state, 1));
				onPressIn?.(event);
			}}
			onPressOut={(event) => {
				pressed.set(animateTo(Motion.state, 0));
				onPressOut?.(event);
			}}
		/>
	);
}
