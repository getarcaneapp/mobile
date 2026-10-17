import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useFrameCallback,
	useSharedValue
} from 'react-native-reanimated';

import { systemColors, withOpacity } from '@/theme/colors';
import { useReduceMotion } from '@/ui/components/accessibility';

import { directPacketDuration, edgePacketDuration } from './environment-connection-logic';

function useAppIsActive() {
	const [active, setActive] = useState(AppState.currentState === 'active');
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) =>
			setActive(state === 'active')
		);
		return () => subscription.remove();
	}, []);
	return active;
}

export function EnvironmentPacketTrack({
	live,
	isEdge,
	leg
}: {
	live: boolean;
	isEdge: boolean;
	leg: 0 | 1;
}) {
	const reduceMotion = useReduceMotion();
	const isActive = useAppIsActive();
	const animating = live && !reduceMotion && isActive;
	const tint = leg === 0 ? systemColors.green : systemColors.blue;
	const width = useSharedValue(0);
	const time = useSharedValue(0);
	const duration = (isEdge ? edgePacketDuration : directPacketDuration) * 1000;

	const frame = useFrameCallback((info) => {
		time.value = info.timestamp;
	}, false);
	useEffect(() => {
		frame.setActive(animating);
	}, [frame, animating]);

	const packetStyle = useAnimatedStyle(() => {
		const phase = (time.value % duration) / duration;
		const progress = isEdge ? 1 - phase : phase < 0.5 ? phase * 2 : (1 - phase) * 2;
		const position = progress * 2 - leg;
		const visible = animating && position >= 0 && position <= 1;
		return {
			opacity: visible ? 1 : 0,
			backgroundColor: progress < 0.5 ? systemColors.green : systemColors.blue,
			transform: [{ translateX: Math.max(0, width.value - 5) * Math.min(Math.max(position, 0), 1) }]
		};
	});

	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			onLayout={(event) => {
				width.value = event.nativeEvent.layout.width;
			}}
			style={{ flex: 1, height: 10, justifyContent: 'center' }}
		>
			<View
				style={{
					height: 2,
					borderRadius: 1,
					backgroundColor: live ? withOpacity(tint, 0.3) : withOpacity(systemColors.gray, 0.2)
				}}
			/>
			<Animated.View
				style={[
					{ position: 'absolute', left: 0, top: 2.5, width: 5, height: 5, borderRadius: 2.5 },
					packetStyle
				]}
			/>
		</View>
	);
}
