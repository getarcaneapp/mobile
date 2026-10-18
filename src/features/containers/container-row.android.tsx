import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSpring
} from 'react-native-reanimated';

import { formatFileBytes } from '@/core/networking/remote-data-limits';
import type {
	ContainerResourceSample,
	ContainerSummary
} from '@/sdk/models/container/ContainerSummary';
import { springConfig } from '@/theme/motion';
import { colors, systemColors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';
import { useIsDark, useReduceMotion } from '@/ui/components/accessibility';
import { CachedAsyncImage } from '@/ui/components/cached-async-image';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { UpdateStateBadge } from '@/ui/components/labels';
import { StatusIcon } from '@/ui/components/resource-status-badge';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	containerDisplayName,
	containerHealth,
	containerIsRunning,
	containerStatusText,
	imageUpdateAccessibility,
	imageUpdateState,
	percentText,
	themedIconUrl
} from './container-model';
import { MetricRing } from './metric-ring';
import type { ContainerRowMetrics } from './use-containers-list';

const healthColor = {
	red: systemColors.red,
	yellow: systemColors.yellow,
	green: systemColors.green
} as const;

export const ContainerResourceText = {
	cpu: (sample: ContainerResourceSample) => percentText(sample.cpuPercent),
	memoryUsed: (sample: ContainerResourceSample) => formatFileBytes(sample.memoryUsageBytes),
	memoryLimit: (sample: ContainerResourceSample) =>
		sample.memoryLimitBytes > 0 ? `of ${formatFileBytes(sample.memoryLimitBytes)}` : undefined,
	accessibility(sample: ContainerResourceSample) {
		const limit = ContainerResourceText.memoryLimit(sample);
		return `CPU ${ContainerResourceText.cpu(sample)}, memory ${ContainerResourceText.memoryUsed(sample)}${limit ? ` ${limit}` : ''}`;
	}
};

function MetricLine({
	progress,
	tint,
	value,
	delay,
	identity
}: {
	progress: number;
	tint: string;
	value?: string;
	delay: number;
	identity?: string;
}) {
	const reduceMotion = useReduceMotion();
	const revealed = useSharedValue(value !== undefined ? 1 : 0);
	const shownIdentity = useRef(identity);
	useEffect(() => {
		const target = value !== undefined ? 1 : 0;
		const recycled = shownIdentity.current !== identity;
		shownIdentity.current = identity;
		revealed.value =
			reduceMotion || recycled
				? target
				: withDelay(
						delay,
						withSpring(
							target,
							springConfig(Motion.entrance.response, Motion.entrance.dampingFraction)
						)
					);
	}, [value, delay, identity, reduceMotion, revealed]);
	const style = useAnimatedStyle(() => ({
		opacity: revealed.value,
		transform: [{ translateX: (1 - revealed.value) * 6 }]
	}));
	return (
		<Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}>
			<Text
				numberOfLines={1}
				style={[m3Type.labelMedium, { color: colors.label, fontVariant: ['tabular-nums'] }]}
			>
				{value ?? '—'}
			</Text>
			<MetricRing progress={progress} tint={tint} size={14} lineWidth={2.5} identity={identity} />
		</Animated.View>
	);
}

export function ContainerResourceMetrics({
	sample,
	identity
}: {
	sample?: ContainerResourceSample;
	identity?: string;
}) {
	const memoryProgress =
		sample && sample.memoryLimitBytes > 0 ? sample.memoryUsageBytes / sample.memoryLimitBytes : 0;
	return (
		<View style={{ alignItems: 'flex-end', gap: 6, minWidth: 76 }}>
			<MetricLine
				progress={(sample?.cpuPercent ?? 0) / 100}
				tint={systemColors.blue}
				value={sample && ContainerResourceText.cpu(sample)}
				delay={0}
				identity={identity}
			/>
			<MetricLine
				progress={memoryProgress}
				tint={systemColors.purple}
				value={sample && ContainerResourceText.memoryUsed(sample)}
				delay={Motion.stagger}
				identity={identity}
			/>
		</View>
	);
}

export function ContainerRow({
	container,
	isPinned = false,
	environmentName,
	environmentColor,
	metrics = { kind: 'hidden' }
}: {
	container: ContainerSummary;
	isPinned?: boolean;
	environmentName?: string;
	environmentColor?: string;
	metrics?: ContainerRowMetrics;
}) {
	const isDark = useIsDark();
	const running = containerIsRunning(container);
	const health = containerHealth(container.status);
	const statusText = containerStatusText(container.status);
	const updateState = imageUpdateState(container.updateInfo);
	const sample = metrics.kind === 'sample' ? metrics.sample : undefined;
	const name = containerDisplayName(container);
	const description = [
		name,
		...(isPinned ? ['pinned'] : []),
		running ? 'running' : 'stopped',
		container.image,
		container.status,
		...(sample ? [ContainerResourceText.accessibility(sample)] : []),
		imageUpdateAccessibility(updateState),
		...(environmentName ? [environmentName] : [])
	].join(', ');

	return (
		<View
			accessible
			accessibilityLabel={description}
			style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 }}
		>
			<View importantForAccessibility="no-hide-descendants">
				<CachedAsyncImage
					url={themedIconUrl(container, isDark)}
					size={36}
					tiled
					fallback={<RowIcon systemImage="cube.box.fill" tint={systemColors.orange} />}
				/>
				<View
					style={{
						position: 'absolute',
						right: -2,
						bottom: -2,
						width: 10,
						height: 10,
						borderRadius: 5,
						backgroundColor: running ? systemColors.green : '#8E8E9380'
					}}
				/>
			</View>

			<View style={{ flex: 1, gap: 6 }}>
				<View style={{ gap: 2 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
						<Text style={[m3Type.bodyLarge, { color: colors.label, flexShrink: 1 }]}>{name}</Text>
						{isPinned ? <Icon name="pin.fill" size={11} color={systemColors.yellow} /> : null}
						{container.hidden === true ? (
							<Icon name="eye.slash.fill" size={11} color={colors.secondaryLabel} />
						) : null}
					</View>
					{statusText !== '' || health ? (
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
							{statusText !== '' ? (
								<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, flexShrink: 1 }]}>
									{statusText}
								</Text>
							) : null}
							{health ? (
								<Icon name={health.icon} size={15} color={healthColor[health.color]} />
							) : null}
						</View>
					) : null}
				</View>
				<UpdateStateBadge state={updateState} />
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</View>

			{metrics.kind === 'hidden' ? (
				<StatusIcon status={container.status} isLive={running} />
			) : (
				<ContainerResourceMetrics sample={sample} identity={container.id} />
			)}
		</View>
	);
}
