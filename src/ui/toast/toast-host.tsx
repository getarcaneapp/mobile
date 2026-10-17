import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	FadeIn,
	FadeOut,
	ReduceMotion,
	SlideInDown,
	SlideOutDown
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useSegments } from 'expo-router';

import { colors } from '@/theme/colors';
import { useAccentColor } from '@/theme/accent';
import { springConfig } from '@/theme/motion';
import { Motion } from '@/theme/tokens';
import { GlassSurface } from '@/ui/glass';
import { Icon } from '@/ui/Icon';

import { dismissToast, useToastPresenter, type Toast } from './presenter';

/** Root dock navigation clearance above the tab bar (iOS 26 glass bar is taller). */
const barClearance = 60;

const toastSpring = springConfig(Motion.toast.response, Motion.toast.dampingFraction);

/** Port of `ToastHost`: the single, app-wide toast overlay. */
export function ToastHost({ reservesTabBarSpace = true }: { reservesTabBarSpace?: boolean }) {
	const toast = useToastPresenter((s) => s.activeToast);
	const insets = useSafeAreaInsets();
	return (
		<View
			pointerEvents="box-none"
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				bottom: insets.bottom + (reservesTabBarSpace ? barClearance : 0)
			}}
		>
			{toast ? <ToastCapsule key={toast.id} toast={toast} /> : null}
		</View>
	);
}

function ToastCapsule({ toast }: { toast: Toast }) {
	const segments = useSegments() as string[];
	// `Toast.activity`'s tap opens the Activity Center (QuickActionRouter.openActivityCenter),
	// presented over the current tab like the Dashboard's toolbar button.
	const tapAction =
		toast.tapAction ??
		(toast.activityID !== undefined && segments[0] === '(tabs)'
			? () => router.push(`/(tabs)/${segments[1] ?? '(dashboard)'}/activity-center` as never)
			: undefined);
	const accent = useAccentColor();
	const { fontScale } = useWindowDimensions();
	const isActivity = toast.activityState !== undefined;
	const swipe = Gesture.Pan().onEnd((event) => {
		if (event.translationY > 30) scheduleOnRN(dismissToast);
	});
	const height = 50 * Math.max(fontScale, 1);

	const content = (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 10,
				paddingHorizontal: 18,
				minHeight: height
			}}
		>
			{toast.symbol ? (
				<Icon
					name={toast.symbol}
					color={toast.symbolTint ?? colors.label}
					size={isActivity ? 17 : 20}
				/>
			) : null}
			<Text
				numberOfLines={isActivity ? 1 : 2}
				style={{
					flex: 1,
					color: colors.label,
					fontSize: isActivity ? 15 : 17,
					fontWeight: isActivity ? '500' : '400'
				}}
			>
				{toast.title}
			</Text>
			{toast.activityProgress !== undefined ? (
				<Text style={{ fontSize: 12, color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>
					{`${Math.round(toast.activityProgress * 100)}%`}
				</Text>
			) : null}
			{toast.actionTitle && toast.action ? (
				<Pressable
					onPress={() => {
						if (toast.action?.()) dismissToast();
					}}
				>
					<Text style={{ color: accent, fontSize: 17 }}>{toast.actionTitle}</Text>
				</Pressable>
			) : null}
		</View>
	);

	return (
		<GestureDetector gesture={swipe}>
			<Animated.View
				entering={SlideInDown.springify()
					.mass(toastSpring.mass ?? 1)
					.stiffness(toastSpring.stiffness ?? 100)
					.damping(toastSpring.damping ?? 10)
					.reduceMotion(ReduceMotion.System)
					.withInitialValues({ originY: 100 })}
				exiting={SlideOutDown.duration(250).reduceMotion(ReduceMotion.System)}
				style={{ paddingHorizontal: 15 }}
				accessibilityRole="alert"
			>
				<Animated.View entering={FadeIn} exiting={FadeOut}>
					<GlassSurface style={{ borderRadius: 999, borderCurve: 'continuous' }}>
						{tapAction ? (
							<Pressable
								onPress={() => {
									tapAction();
									dismissToast();
								}}
							>
								{content}
							</Pressable>
						) : (
							content
						)}
					</GlassSurface>
				</Animated.View>
			</Animated.View>
		</GestureDetector>
	);
}
