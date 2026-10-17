import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

import type { MotionToken } from './tokens';

/**
 * SwiftUI `.spring(response:dampingFraction:)` → Reanimated spring config.
 * stiffness = (2π / response)², damping = 4π · ζ / response (unit mass).
 */
export function springConfig(response: number, dampingFraction: number): WithSpringConfig {
	const stiffness = Math.pow((2 * Math.PI) / response, 2);
	return {
		mass: 1,
		stiffness,
		damping: 2 * dampingFraction * Math.sqrt(stiffness)
	};
}

const easings = {
	easeOut: Easing.out(Easing.cubic),
	easeInOut: Easing.inOut(Easing.cubic),
	linear: Easing.linear,
	// SwiftUI `.smooth` is a critically damped spring; this bezier is a close match.
	smooth: Easing.bezier(0.25, 0.1, 0.25, 1)
};

export function timingConfig(token: Extract<MotionToken, { type: 'timing' }>): WithTimingConfig {
	return { duration: token.duration, easing: easings[token.easing] };
}
