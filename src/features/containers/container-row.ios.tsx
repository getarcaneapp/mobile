import { Circle, HStack, RNHostView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	animation,
	accessibilityHidden,
	accessibilityLabel,
	contentTransition,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	monospacedDigit,
	offset,
	opacity,
	padding
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { formatFileBytes } from '@/core/networking/remote-data-limits';
import type {
	ContainerResourceSample,
	ContainerSummary
} from '@/sdk/models/container/ContainerSummary';
import { systemColors, withOpacity } from '@/theme/colors';
import { Motion } from '@/theme/tokens';
import { secondaryHex, useIsDark, useReduceMotion } from '@/ui/components/accessibility';
import { CachedAsyncImageSwiftUI } from '@/ui/components/cached-async-image-swiftui';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { UpdateStateBadge } from '@/ui/components/labels';
import { StatusIcon } from '@/ui/components/resource-status-badge';
import { RowIcon } from '@/ui/components/row-icon';
import { hashKey, motionAwareAnimation, swiftAnimation } from '@/ui/components/swiftui-motion';

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

function memoryPercent(sample: ContainerResourceSample) {
	return sample.memoryLimitBytes > 0
		? (sample.memoryUsageBytes / sample.memoryLimitBytes) * 100
		: 0;
}

export function ContainerResourceMetrics({
	sample,
	identity
}: {
	sample?: ContainerResourceSample;
	identity?: string;
}) {
	const reduceMotion = useReduceMotion();
	const metric = (
		progress: number,
		tint: string,
		value: string | undefined,
		revealDelay: number
	) => {
		const isRevealed = value !== undefined;
		return (
			<HStack
				spacing={6}
				modifiers={[
					lineLimit(1),
					fixedSize(),
					opacity(isRevealed ? 1 : 0),
					offset({ x: isRevealed ? 0 : 6 }),
					...(reduceMotion
						? []
						: [animation(swiftAnimation(Motion.entrance).delay(revealDelay / 1000), isRevealed)])
				]}
			>
				<Text
					modifiers={[
						font({ textStyle: 'caption', weight: 'semibold' }),
						monospacedDigit(),
						contentTransition('numericText'),
						...motionAwareAnimation(Motion.state, hashKey(value ?? ''), reduceMotion)
					]}
				>
					{value ?? '—'}
				</Text>
				<HStack modifiers={[frame({ width: 14, height: 14 })]}>
					<RNHostView matchContents>
						<View style={{ width: 14, height: 14 }}>
							<MetricRing
								progress={progress}
								tint={tint}
								size={14}
								lineWidth={2.5}
								identity={identity}
							/>
						</View>
					</RNHostView>
				</HStack>
			</HStack>
		);
	};
	return (
		<VStack
			alignment="trailing"
			spacing={6}
			modifiers={[frame({ minWidth: 76, alignment: 'trailing' })]}
		>
			{metric(
				(sample?.cpuPercent ?? 0) / 100,
				systemColors.blue,
				sample ? ContainerResourceText.cpu(sample) : undefined,
				0
			)}
			{metric(
				(sample ? memoryPercent(sample) : 0) / 100,
				systemColors.purple,
				sample ? ContainerResourceText.memoryUsed(sample) : undefined,
				Motion.stagger
			)}
		</VStack>
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
	const reduceMotion = useReduceMotion();
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
		<HStack
			spacing={12}
			modifiers={[
				padding({ vertical: 2 }),
				accessibilityElement('combine'),
				accessibilityLabel(description)
			]}
		>
			<ZStack alignment="bottomTrailing" modifiers={[accessibilityHidden(true)]}>
				<CachedAsyncImageSwiftUI
					url={themedIconUrl(container, isDark)}
					size={36}
					tiled
					fallback={<RowIcon systemImage="cube.box.fill" tint={systemColors.orange} />}
				/>
				<Circle
					modifiers={[
						foregroundStyle(
							running
								? systemColors.green
								: withOpacity(secondaryHex[isDark ? 'dark' : 'light'], 0.3)
						),
						frame({ width: 10, height: 10 }),
						offset({ x: 2, y: 2 }),
						...motionAwareAnimation(Motion.state, running, reduceMotion)
					]}
				/>
			</ZStack>

			<VStack alignment="leading" spacing={6}>
				<VStack alignment="leading" spacing={2}>
					<HStack spacing={4}>
						<Text modifiers={[font({ textStyle: 'body' })]}>{name}</Text>
						{isPinned ? (
							<Image
								systemName="pin.fill"
								modifiers={[
									font({ textStyle: 'caption2' }),
									foregroundStyle(systemColors.yellow),
									accessibilityHidden(true)
								]}
							/>
						) : null}
						{container.hidden === true ? (
							<Image
								systemName="eye.slash.fill"
								modifiers={[
									font({ textStyle: 'caption2' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
									accessibilityLabel('Hidden')
								]}
							/>
						) : null}
					</HStack>
					{statusText !== '' || health ? (
						<HStack spacing={5}>
							{statusText !== '' ? (
								<Text
									modifiers={[
										font({ textStyle: 'subheadline' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>
									{statusText}
								</Text>
							) : null}
							{health ? (
								<Image
									systemName={health.icon as never}
									modifiers={[
										font({ textStyle: 'subheadline' }),
										foregroundStyle(healthColor[health.color]),
										accessibilityLabel(health.label)
									]}
								/>
							) : null}
						</HStack>
					) : null}
				</VStack>
				<UpdateStateBadge state={updateState} />
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</VStack>

			<Spacer minLength={8} />

			{metrics.kind === 'hidden' ? (
				<StatusIcon status={container.status} isLive={running} />
			) : (
				<ContainerResourceMetrics sample={sample} identity={container.id} />
			)}
		</HStack>
	);
}
