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

export function swiftAnimation(token: MotionToken): ChainableAnimationType {
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

export function motionAwareAnimation(
	token: MotionToken,
	value: number | boolean,
	reduceMotion: boolean
): ModifierConfig[] {
	return reduceMotion ? [] : [animation(swiftAnimation(token), value)];
}

export function hashKey(key: string): number {
	let hash = 5381;
	for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
	return hash;
}

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

export function ScrollEdgeFadeSwiftUI({ children }: { scales?: boolean; children: ReactNode }) {
	return <>{children}</>;
}

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

export const pressableButtonStyle = (): ModifierConfig => buttonStyle('plain');
export const cardRowLinkStyle = (): ModifierConfig => buttonStyle('plain');
