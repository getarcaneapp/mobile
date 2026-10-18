import { Button, HStack, Popover, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityHidden,
	accessibilityHint,
	accessibilityLabel,
	background,
	buttonBorderShape,
	buttonStyle,
	contentShape,
	contentTransition,
	controlSize,
	disabled,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	minimumScaleFactor,
	monospacedDigit,
	opacity,
	padding,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useLaunchSplash } from '@/stores/launch-splash-store';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { Motion, Radius } from '@/theme/tokens';
import { useReduceMotion } from '@/ui/components/accessibility';
import { SkeletonCircle, SkeletonRect, SkeletonShimmer } from '@/ui/components/skeleton';
import { GlassCardBackground } from '@/ui/components/swiftui-surfaces';
import { cardRowLinkStyle, motionAwareAnimation, hashKey } from '@/ui/components/swiftui-motion';

import {
	greetingFor,
	showsAllEnvironmentsCountNote,
	typedGreetings,
	type DashboardCountIssue
} from '../dashboard-logic';

export function DashboardStatTile({
	title,
	value,
	icon,
	tint: tintColor,
	onPress
}: {
	title: string;
	value: string;
	icon: string;
	tint: string;
	onPress?: () => void;
	onLongPress?: () => void;
}) {
	const reduceMotion = useReduceMotion();
	const content = (
		<VStack
			alignment="leading"
			spacing={3}
			modifiers={[
				frame({ maxWidth: Infinity, alignment: 'leading' }),
				contentShape(shapes.rectangle())
			]}
		>
			<Text
				modifiers={[
					font({ textStyle: 'title3', design: 'rounded', weight: 'semibold' }),
					monospacedDigit(),
					foregroundStyle('primary'),
					lineLimit(1),
					minimumScaleFactor(0.6),
					contentTransition('numericText'),
					...motionAwareAnimation(Motion.state, hashKey(value), reduceMotion)
				]}
			>
				{value}
			</Text>
			<HStack spacing={4}>
				<Image
					systemName={icon as SFSymbol}
					modifiers={[
						font({ size: 9, weight: 'semibold' }),
						foregroundStyle(tintColor),
						accessibilityHidden(true)
					]}
				/>
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1),
						minimumScaleFactor(0.75)
					]}
				>
					{title}
				</Text>
			</HStack>
		</VStack>
	);
	if (!onPress) {
		return (
			<VStack
				modifiers={[
					frame({ maxWidth: Infinity }),
					accessibilityElement('ignore'),
					accessibilityLabel(`${title}: ${value}`)
				]}
			>
				{content}
			</VStack>
		);
	}
	return (
		<Button
			onPress={onPress}
			modifiers={[
				cardRowLinkStyle(),
				frame({ maxWidth: Infinity }),
				accessibilityElement('ignore'),
				accessibilityLabel(`${title}: ${value}`),
				accessibilityAddTraits(['isButton']),
				accessibilityHint(`Opens ${title}`)
			]}
		>
			{content}
		</Button>
	);
}

export function DashboardSectionTitle({ title }: { title: string }) {
	return (
		<Text
			modifiers={[font({ textStyle: 'title3', weight: 'semibold' }), foregroundStyle('primary')]}
		>
			{title}
		</Text>
	);
}

export function DashboardRowChevron() {
	return (
		<Image
			systemName="chevron.right"
			modifiers={[
				font({ textStyle: 'footnote', weight: 'semibold' }),
				foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
				accessibilityHidden(true)
			]}
		/>
	);
}

export function StreamFailedBanner({ onRetry }: { onRetry: () => void }) {
	return (
		<HStack
			spacing={8}
			modifiers={[
				padding({ horizontal: 14, vertical: 10 }),
				background(
					withOpacity(systemColors.orange, 0.1),
					shapes.roundedRectangle({
						cornerRadius: Radius.standard,
						roundedCornerStyle: 'continuous'
					})
				)
			]}
		>
			<Image
				systemName="wifi.exclamationmark"
				modifiers={[
					font({ textStyle: 'subheadline', weight: 'semibold' }),
					foregroundStyle(systemColors.orange)
				]}
			/>
			<Text
				modifiers={[
					font({ textStyle: 'subheadline' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				Live counts paused
			</Text>
			<Spacer />
			<Button
				onPress={onRetry}
				modifiers={[
					font({ textStyle: 'subheadline', weight: 'semibold' }),
					buttonStyle('borderless')
				]}
			>
				<Text>Retry</Text>
			</Button>
		</HStack>
	);
}

export function UpdateAllButton({
	upgrades,
	armed,
	onPress
}: {
	upgrades: number | undefined;
	armed: boolean;
	onPress: () => void;
}) {
	const accent = useAccentColor();
	const reduceMotion = useReduceMotion();
	const isUpToDate = upgrades === 0;
	const symbol = isUpToDate
		? 'checkmark'
		: armed
			? 'checkmark.circle.fill'
			: 'arrow.up.circle.fill';
	return (
		<Button
			onPress={onPress}
			modifiers={[
				buttonStyle('borderedProminent'),
				buttonBorderShape('capsule'),
				controlSize('small'),
				tint(armed ? systemColors.red : accent),
				disabled(isUpToDate),
				...motionAwareAnimation(armed ? Motion.entrance : Motion.state, armed, reduceMotion),
				accessibilityLabel(
					isUpToDate
						? 'All environments are up to date'
						: armed
							? 'Confirm update of all environments'
							: `Update All${upgrades !== undefined ? `, ${upgrades} environments have upgrades` : ''}`
				),
				accessibilityHint(armed ? 'Starts updating every environment' : 'Tap again to confirm')
			]}
		>
			<HStack
				spacing={6}
				modifiers={[
					font({ textStyle: 'subheadline', weight: 'semibold' }),
					frame({ minWidth: 20 })
				]}
			>
				<Image systemName={symbol as SFSymbol} modifiers={[contentTransition('interpolate')]} />
				{armed ? (
					<Text modifiers={[fixedSize()]}>Confirm Update</Text>
				) : upgrades !== undefined && upgrades > 0 ? (
					<Text modifiers={[monospacedDigit(), fixedSize()]}>{String(upgrades)}</Text>
				) : null}
			</HStack>
		</Button>
	);
}

export function CountAvailabilityNote({
	issues,
	allEnvironmentsPreview,
	enabledEnvironmentCount,
	isPresented,
	setPresented
}: {
	issues: DashboardCountIssue[];
	allEnvironmentsPreview: boolean;
	enabledEnvironmentCount: number;
	isPresented: boolean;
	setPresented: (value: boolean) => void;
}) {
	if (issues.length === 0) {
		if (!showsAllEnvironmentsCountNote(allEnvironmentsPreview, enabledEnvironmentCount))
			return null;
		return (
			<HStack spacing={4} modifiers={[padding({ horizontal: 4 })]}>
				<Image
					systemName="server.rack"
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				/>
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					Counts include all enabled environments.
				</Text>
			</HStack>
		);
	}
	return (
		<Popover isPresented={isPresented} onIsPresentedChange={setPresented} arrowEdge="top">
			<Popover.Trigger>
				<Button
					onPress={() => setPresented(true)}
					modifiers={[
						buttonStyle('plain'),
						padding({ horizontal: 4 }),
						accessibilityHint('Shows which environment counts could not be loaded')
					]}
				>
					<HStack spacing={4}>
						<Image
							systemName="exclamationmark.triangle.fill"
							modifiers={[
								font({ textStyle: 'caption2', weight: 'medium' }),
								foregroundStyle(systemColors.orange)
							]}
						/>
						<Text
							modifiers={[
								font({ textStyle: 'caption2', weight: 'medium' }),
								foregroundStyle(systemColors.orange)
							]}
						>
							Some environment counts are unavailable.
						</Text>
					</HStack>
				</Button>
			</Popover.Trigger>
			<Popover.Content>
				<VStack
					alignment="leading"
					spacing={14}
					modifiers={[
						padding({ all: 16 }),
						frame({ idealWidth: 300, maxWidth: 340, alignment: 'leading' })
					]}
				>
					<HStack spacing={6}>
						<Image
							systemName="exclamationmark.triangle.fill"
							modifiers={[font({ textStyle: 'headline' }), foregroundStyle(systemColors.orange)]}
						/>
						<Text
							modifiers={[font({ textStyle: 'headline' }), foregroundStyle(systemColors.orange)]}
						>
							Incomplete environment counts
						</Text>
					</HStack>
					{issues.map((issue) => (
						<VStack
							key={issue.id}
							alignment="leading"
							spacing={3}
							modifiers={[accessibilityElement('combine')]}
						>
							<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
								{issue.title}
							</Text>
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{issue.detail}
							</Text>
						</VStack>
					))}
					<Text
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						Pull down on the Dashboard to retry unavailable environments.
					</Text>
				</VStack>
			</Popover.Content>
		</Popover>
	);
}

export function DashboardGreeting({ userName }: { userName: string | undefined }) {
	const reduceMotion = useReduceMotion();
	const isSplashPresented = useLaunchSplash((s) => s.isPresented);
	const name = greetingFor(userName);
	const [visibleCount, setVisibleCount] = useState(() =>
		typedGreetings.has(name) ? name.length : 0
	);
	const [faded, setFaded] = useState(false);

	useEffect(() => {
		if (isSplashPresented || !name) return;
		if (typedGreetings.has(name)) {
			setVisibleCount(name.length);
			return;
		}
		typedGreetings.add(name);
		if (reduceMotion) {
			setFaded(true);
			setVisibleCount(name.length);
			const timer = setTimeout(() => setFaded(false), 16);
			return () => clearTimeout(timer);
		}
		let count = 0;
		setVisibleCount(0);
		const timer = setInterval(() => {
			count += 1;
			setVisibleCount(count);
			if (count >= name.length) clearInterval(timer);
		}, 55);
		return () => {
			clearInterval(timer);
			setVisibleCount(name.length);
		};
	}, [name, isSplashPresented, reduceMotion]);

	return (
		<HStack
			modifiers={[
				padding({ bottom: -16 }),
				accessibilityElement('ignore'),
				accessibilityLabel(name),
				accessibilityAddTraits(['isHeader'])
			]}
		>
			<ZStack
				alignment="leading"
				modifiers={[
					font({ textStyle: 'largeTitle', weight: 'bold' }),
					lineLimit(1),
					minimumScaleFactor(0.6)
				]}
			>
				<Text modifiers={[opacity(0)]}>{name || ' '}</Text>
				<Text
					modifiers={[
						opacity(faded ? 0 : 1),
						...motionAwareAnimation(Motion.reducedFallback, faded, false)
					]}
				>
					{name.slice(0, visibleCount)}
				</Text>
			</ZStack>
			<Spacer />
		</HStack>
	);
}

function SkeletonTile() {
	return (
		<VStack
			alignment="leading"
			spacing={6}
			modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
		>
			<SkeletonRect width={44} height={20} />
			<SkeletonRect width={56} height={10} cornerRadius={3} />
		</VStack>
	);
}

function SkeletonEnvironmentCard() {
	return (
		<GlassCardBackground>
			<VStack
				alignment="leading"
				spacing={14}
				modifiers={[padding({ all: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}
			>
				<HStack>
					<VStack alignment="leading" spacing={6}>
						<SkeletonRect width={150} height={16} />
						<SkeletonRect width={90} height={10} cornerRadius={3} />
					</VStack>
					<Spacer />
					<SkeletonCircle size={22} />
				</HStack>
				<HStack spacing={12}>
					{[0, 1, 2, 3].map((i) => (
						<VStack key={i} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
							<SkeletonRect width={56} height={30} />
						</VStack>
					))}
				</HStack>
				<HStack spacing={16}>
					{[0, 1, 2].map((i) => (
						<HStack
							key={i}
							spacing={7}
							modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
						>
							<SkeletonCircle size={18} />
							<SkeletonRect width={52} height={12} />
						</HStack>
					))}
				</HStack>
			</VStack>
		</GlassCardBackground>
	);
}

export function DashboardSkeleton() {
	return (
		<SkeletonShimmer>
			<VStack
				alignment="leading"
				spacing={24}
				modifiers={[accessibilityHidden(true), disabled(true)]}
			>
				<GlassCardBackground>
					<HStack
						alignment="top"
						spacing={8}
						modifiers={[padding({ horizontal: 16, vertical: 14 })]}
					>
						{[0, 1, 2, 3].map((i) => (
							<SkeletonTile key={i} />
						))}
					</HStack>
				</GlassCardBackground>
				<VStack alignment="leading" spacing={12}>
					<SkeletonRect width={150} height={20} />
					<SkeletonEnvironmentCard />
					<SkeletonEnvironmentCard />
				</VStack>
			</VStack>
		</SkeletonShimmer>
	);
}
