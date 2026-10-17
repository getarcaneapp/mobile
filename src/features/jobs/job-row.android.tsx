/**
 * Android ports of `JobRow` and `JobBadge` (JobsListView.swift). Standalone
 * (RN views); the icon spins while the job is running.
 */
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';

import type { JobStatus } from '@/sdk/models/jobSchedule/JobSchedule';
import { colors } from '@/theme/colors';
import { useReduceMotion } from '@/ui/components/accessibility';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';

import { jobBadge, jobIcon, jobTint, relativeNamed } from './job-model';

export function JobBadge({ text, tint }: { text: string; tint: string }) {
	return <Text style={[m3Type.labelSmall, { fontWeight: '700', color: tint }]}>{text}</Text>;
}

function SpinningIcon({
	systemImage,
	tint,
	spinning
}: {
	systemImage: string;
	tint: string;
	spinning: boolean;
}) {
	const reduceMotion = useReduceMotion();
	const rotation = useSharedValue(0);
	useEffect(() => {
		if (spinning && !reduceMotion) {
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
	}, [spinning, reduceMotion, rotation]);
	const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
	return (
		<Animated.View style={style}>
			<RowIcon systemImage={systemImage} tint={tint} />
		</Animated.View>
	);
}

export function JobRow({
	job,
	isRunning,
	environmentName,
	environmentColor
}: {
	job: JobStatus;
	isRunning: boolean;
	environmentName?: string;
	environmentColor?: string;
}) {
	const next = relativeNamed(job.nextRun);
	const badge = jobBadge(job);
	return (
		<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
			<SpinningIcon
				systemImage={jobIcon(job, isRunning)}
				tint={jobTint(job, isRunning)}
				spinning={isRunning}
			/>
			<View style={{ flex: 1, gap: 4 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{job.name}</Text>
				{job.description !== '' ? (
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						{job.description}
					</Text>
				) : null}
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
					<Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel, fontFamily: monoFamily }]}>
						{job.schedule}
					</Text>
					{next !== undefined ? (
						<>
							<Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel }]}>•</Text>
							<Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel }]}>{next}</Text>
						</>
					) : null}
				</View>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</View>
			{badge ? <JobBadge text={badge.text} tint={badge.tint} /> : null}
		</View>
	);
}
