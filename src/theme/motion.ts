import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

import type { MotionToken } from './tokens';

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
	smooth: Easing.bezier(0.25, 0.1, 0.25, 1)
};

export function timingConfig(token: Extract<MotionToken, { type: 'timing' }>): WithTimingConfig {
	return { duration: token.duration, easing: easings[token.easing] };
}
