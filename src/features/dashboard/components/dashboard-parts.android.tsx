import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useLaunchSplash } from '@/stores/launch-splash-store';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { useReduceMotion } from '@/ui/components/accessibility';
import { m3 } from '@/ui/components/material-colors';
import { SkeletonCircle, SkeletonRect, SkeletonShimmer } from '@/ui/components/skeleton';
import { GlassCard } from '@/ui/components/surfaces';
import { m3Type } from '@/ui/components/type-scale';

import { greetingFor, typedGreetings, type DashboardCountIssue } from '../dashboard-logic';
import { MaterialSheet } from './material-sheet';

export function DashboardStatTile({
	title,
	value,
	icon,
	tint,
	onPress,
	onLongPress
}: {
	title: string;
	value: string;
	icon: string;
	tint: string;
	onPress?: () => void;
	onLongPress?: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			disabled={!onPress && !onLongPress}
			android_ripple={
				onPress ? { color: colors.separator as string, borderless: false } : undefined
			}
			accessibilityRole={onPress ? 'button' : 'text'}
			accessibilityLabel={`${title}: ${value}`}
			accessibilityHint={onPress ? `Opens ${title}` : undefined}
			style={{ flex: 1, gap: 3, borderRadius: Radius.small, paddingVertical: 2 }}
		>
			<Text
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.6}
				style={[
					m3Type.titleLarge,
					{ fontWeight: '600', color: colors.label, fontVariant: ['tabular-nums'] }
				]}
			>
				{value}
			</Text>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
				<Icon name={icon} size={11} color={tint} />
				<Text numberOfLines={1} style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
					{title}
				</Text>
			</View>
		</Pressable>
	);
}

export function DashboardSectionTitle({ title }: { title: string }) {
	return (
		<Text
			accessibilityRole="header"
			style={[m3Type.titleLarge, { color: colors.label, fontWeight: '500' }]}
		>
			{title}
		</Text>
	);
}

export function DashboardRowChevron() {
	return <Icon name="chevron.right" size={18} color={colors.tertiaryLabel} />;
}

export function StreamFailedBanner({ onRetry }: { onRetry: () => void }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				paddingHorizontal: 14,
				paddingVertical: 6,
				borderRadius: Radius.standard,
				backgroundColor: withOpacity(systemColors.orange, 0.12)
			}}
		>
			<Icon name="wifi.exclamationmark" size={18} color={systemColors.orange} />
			<Text style={[m3Type.bodyMedium, { flex: 1, color: colors.secondaryLabel }]}>
				Live counts paused
			</Text>
			<Pressable
				onPress={onRetry}
				android_ripple={{ color: colors.separator as string }}
				style={{ paddingHorizontal: 12, paddingVertical: 10 }}
			>
				<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Retry</Text>
			</Pressable>
		</View>
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
	const isUpToDate = upgrades === 0;
	const container = armed ? m3.error : isUpToDate ? m3.surfaceContainerHighest : m3.primary;
	const content = armed ? '#FFFFFF' : isUpToDate ? m3.onSurfaceVariant : m3.onPrimary;
	return (
		<Pressable
			onPress={onPress}
			disabled={isUpToDate}
			accessibilityRole="button"
			accessibilityLabel={
				isUpToDate
					? 'All environments are up to date'
					: armed
						? 'Confirm update of all environments'
						: `Update All${upgrades !== undefined ? `, ${upgrades} environments have upgrades` : ''}`
			}
			accessibilityHint={armed ? 'Starts updating every environment' : 'Tap again to confirm'}
			android_ripple={{ color: withOpacity('#FFFFFF', 0.3) }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 6,
				minWidth: 40,
				height: 32,
				paddingHorizontal: 12,
				borderRadius: 16,
				overflow: 'hidden',
				backgroundColor: container,
				opacity: isUpToDate ? 0.6 : 1
			}}
		>
			<Icon
				name={isUpToDate ? 'checkmark' : armed ? 'checkmark.circle.fill' : 'arrow.up.circle.fill'}
				size={18}
				color={content}
			/>
			{armed ? (
				<Text style={[m3Type.labelLarge, { color: content }]}>Confirm Update</Text>
			) : upgrades !== undefined && upgrades > 0 ? (
				<Text style={[m3Type.labelLarge, { color: content, fontVariant: ['tabular-nums'] }]}>
					{String(upgrades)}
				</Text>
			) : null}
		</Pressable>
	);
}

export function CountAvailabilityNote({
	issues,
	allEnvironmentsPreview,
	isPresented,
	setPresented
}: {
	issues: DashboardCountIssue[];
	allEnvironmentsPreview: boolean;
	isPresented: boolean;
	setPresented: (value: boolean) => void;
}) {
	if (issues.length === 0) {
		if (allEnvironmentsPreview) return null;
		return (
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
				<Icon name="server.rack" size={12} color={colors.secondaryLabel} />
				<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
					Counts include all enabled environments.
				</Text>
			</View>
		);
	}
	return (
		<>
			<Pressable
				onPress={() => setPresented(true)}
				accessibilityRole="button"
				accessibilityHint="Shows which environment counts could not be loaded"
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 4,
					paddingHorizontal: 4,
					paddingVertical: 4
				}}
			>
				<Icon name="exclamationmark.triangle.fill" size={12} color={systemColors.orange} />
				<Text style={[m3Type.labelSmall, { color: systemColors.orange }]}>
					Some environment counts are unavailable.
				</Text>
			</Pressable>
			<MaterialSheet isPresented={isPresented} onDismiss={() => setPresented(false)}>
				<View style={{ gap: 14, paddingHorizontal: 24, paddingBottom: 32 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
						<Icon name="exclamationmark.triangle.fill" size={20} color={systemColors.orange} />
						<Text style={[m3Type.titleMedium, { color: systemColors.orange }]}>
							Incomplete environment counts
						</Text>
					</View>
					{issues.map((issue) => (
						<View key={issue.id} style={{ gap: 3 }} accessible>
							<Text style={[m3Type.titleSmall, { color: colors.label }]}>{issue.title}</Text>
							<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
								{issue.detail}
							</Text>
						</View>
					))}
					<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
						Pull down on the Dashboard to retry unavailable environments.
					</Text>
				</View>
			</MaterialSheet>
		</>
	);
}

export function DashboardGreeting({ userName }: { userName: string | undefined }) {
	const reduceMotion = useReduceMotion();
	const isSplashPresented = useLaunchSplash((s) => s.isPresented);
	const name = greetingFor(userName);
	const [visibleCount, setVisibleCount] = useState(() =>
		typedGreetings.has(name) ? name.length : 0
	);

	useEffect(() => {
		if (isSplashPresented || !name) return;
		if (typedGreetings.has(name) || reduceMotion) {
			typedGreetings.add(name);
			setVisibleCount(name.length);
			return;
		}
		typedGreetings.add(name);
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
		<Text
			accessibilityRole="header"
			accessibilityLabel={name}
			numberOfLines={1}
			adjustsFontSizeToFit
			minimumFontScale={0.6}
			style={{
				fontSize: 32,
				lineHeight: 40,
				fontWeight: '500',
				color: colors.label,
				marginBottom: -16
			}}
		>
			{name.slice(0, visibleCount) || ' '}
			<Text style={{ color: 'transparent' }}>{name.slice(visibleCount)}</Text>
		</Text>
	);
}

function SkeletonEnvironmentCard() {
	return (
		<GlassCard style={{ padding: 16, gap: 14 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<View style={{ flex: 1, gap: 6 }}>
					<SkeletonRect width={150} height={16} />
					<SkeletonRect width={90} height={10} cornerRadius={3} />
				</View>
				<SkeletonCircle size={22} />
			</View>
			<View style={{ flexDirection: 'row', gap: 12 }}>
				{[0, 1, 2, 3].map((i) => (
					<View key={i} style={{ flex: 1 }}>
						<SkeletonRect width={56} height={30} />
					</View>
				))}
			</View>
			<View style={{ flexDirection: 'row', gap: 16 }}>
				{[0, 1, 2].map((i) => (
					<View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
						<SkeletonCircle size={18} />
						<SkeletonRect width={52} height={12} />
					</View>
				))}
			</View>
		</GlassCard>
	);
}

export function DashboardSkeleton() {
	return (
		<SkeletonShimmer>
			<View
				style={{ gap: 24 }}
				pointerEvents="none"
				importantForAccessibility="no-hide-descendants"
			>
				<GlassCard
					style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 14 }}
				>
					{[0, 1, 2, 3].map((i) => (
						<View key={i} style={{ flex: 1, gap: 6 }}>
							<SkeletonRect width={44} height={20} />
							<SkeletonRect width={56} height={10} cornerRadius={3} />
						</View>
					))}
				</GlassCard>
				<View style={{ gap: 12 }}>
					<SkeletonRect width={150} height={20} />
					<SkeletonEnvironmentCard />
					<SkeletonEnvironmentCard />
				</View>
			</View>
		</SkeletonShimmer>
	);
}
