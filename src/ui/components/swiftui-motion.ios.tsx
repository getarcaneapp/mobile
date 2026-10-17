/**
 * SwiftUI-tree ports of the `Motion.swift` modifiers for @expo/ui trees.
 * Every export here returns @expo/ui swift-ui elements or modifiers (no Host);
 * compose them inside an existing SwiftUI tree. iOS only.
 *
 * SwiftUI-tree.
 */
import { Group, ZStack } from '@expo/ui/swift-ui';
import {
	Animation,
	animation,
	buttonStyle,
	offset,
	onAppear,
	opacity,
	scaleEffect,
	type ChainableAnimationType,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import { useState, type ReactNode } from 'react';

import { Motion, type MotionToken } from '@/theme/tokens';

import { useReduceMotion } from './accessibility';
import { seenEntranceIdentities } from './motion-views';

/** A Motion token as a SwiftUI `Animation`, with the same curve the Swift app uses. */
export function swiftAnimation(token: MotionToken): ChainableAnimationType {
	// These two are `.interpolatingSpring(duration:)` in Motion.swift.
	if (token === Motion.overlay) return Animation.interpolatingSpring({ duration: 0.3 });
	if (token === Motion.toast) return Animation.interpolatingSpring({ duration: 0.35, bounce: 0 });
	if (token.type === 'spring') {
		return Animation.spring({ response: token.response, dampingFraction: token.dampingFraction });
	}
	const duration = token.duration / 1000;
	switch (token.easing) {
		case 'smooth':
			return Animation.smooth({ duration });
		case 'easeOut':
			return Animation.easeOut({ duration });
		case 'easeInOut':
			return Animation.easeInOut({ duration });
		case 'linear':
			return Animation.linear({ duration });
	}
}

/**
 * `.motionAwareAnimation(_:value:)`: an implicit animation that disappears when
 * Reduce Motion is on. Returns an empty list in that case so it can be spread.
 */
export function motionAwareAnimation(
	token: MotionToken,
	value: number | boolean,
	reduceMotion: boolean
): ModifierConfig[] {
	return reduceMotion ? [] : [animation(swiftAnimation(token), value)];
}

/** A stable number for a string, so string keys can drive `animation(_:value:)`. */
export function hashKey(key: string): number {
	let hash = 5381;
	for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
	return hash;
}

/** Port of `.cardEntrance(id:index:)`: one-shot 2% scale + fade, latched per identity for the session. */
export function CardEntrance({
	id,
	index = 0,
	children
}: {
	id: string;
	index?: number;
	children: ReactNode;
}) {
	const reduceMotion = useReduceMotion();
	const [hasPlayed, setHasPlayed] = useState(() => seenEntranceIdentities.has(id));
	const entrance = reduceMotion
		? swiftAnimation(Motion.reducedFallback)
		: swiftAnimation(Motion.entrance).delay((index * Motion.stagger) / 1000);
	return (
		<Group
			modifiers={[
				scaleEffect(reduceMotion || hasPlayed ? 1 : 0.97),
				opacity(hasPlayed ? 1 : 0),
				animation(entrance, hasPlayed),
				onAppear(() => {
					if (hasPlayed || seenEntranceIdentities.has(id)) return;
					seenEntranceIdentities.add(id);
					setHasPlayed(true);
				})
			]}
		>
			{children}
		</Group>
	);
}

/** Port of `.staggeredReveal(index:)`: rise + fade that replays on every appear. */
export function StaggeredReveal({ index, children }: { index: number; children: ReactNode }) {
	const reduceMotion = useReduceMotion();
	const [revealed, setRevealed] = useState(false);
	const entrance = reduceMotion
		? swiftAnimation(Motion.reducedFallback)
		: swiftAnimation(Motion.entrance).delay((index * Motion.stagger) / 1000);
	return (
		<Group
			modifiers={[
				offset({ y: reduceMotion || revealed ? 0 : 6 }),
				opacity(revealed ? 1 : 0),
				animation(entrance, revealed),
				onAppear(() => setRevealed(true))
			]}
		>
			{children}
		</Group>
	);
}

/**
 * Port of `.scrollEdgeFade(scales:)`. @expo/ui has no `scrollTransition`, so in
 * SwiftUI trees this renders its content unchanged. Use `ScrollEdgeFade` from
 * `motion-views` for RN scroll views.
 */
export function ScrollEdgeFadeSwiftUI({ children }: { scales?: boolean; children: ReactNode }) {
	return <>{children}</>;
}

/**
 * Port of `LoadingCrossfade`. The default SwiftUI insertion/removal transition
 * is `.opacity`, so an implicit `Motion.state` animation on the ZStack gives the
 * same cross-fade. Set `animatesTransition` false when a branch is a `List`.
 */
export function LoadingCrossfade({
	showSkeleton,
	animatesTransition = true,
	skeleton,
	children
}: {
	showSkeleton: boolean;
	animatesTransition?: boolean;
	skeleton: ReactNode;
	children: ReactNode;
}) {
	const reduceMotion = useReduceMotion();
	if (!animatesTransition) return <>{showSkeleton ? skeleton : children}</>;
	return (
		<ZStack modifiers={motionAwareAnimation(Motion.state, showSkeleton, reduceMotion)}>
			{showSkeleton ? skeleton : children}
		</ZStack>
	);
}

/**
 * `PressableButtonStyle` / `CardRowLinkStyle` for SwiftUI-tree buttons. @expo/ui
 * can't author a custom `ButtonStyle` (no access to `isPressed`), so both map to
 * `.plain`, which keeps the system press dim but not the scale.
 */
export const pressableButtonStyle = (): ModifierConfig => buttonStyle('plain');
export const cardRowLinkStyle = (): ModifierConfig => buttonStyle('plain');
