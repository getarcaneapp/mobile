/**
 * Android (Material 3) rendering of `EnvironmentListRow`: one environment card
 * with counts, version line and CPU / memory / disk rings; long press opens
 * the actions menu.
 *
 * Standalone (RN view).
 */
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, parseHex, systemColors } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { monoFamily, m3Type } from '@/ui/components/type-scale';
import { GlassCard } from '@/ui/components/surfaces';

import { revealedEnvironmentIDs, ringValueText, useEnvironmentRow } from '../use-environment-row';
import type { EnvironmentRowProps } from './environment-row.types';
import { MaterialMenu } from './material-menu';
import { MetricRing } from './metric-ring';

// Read per render: colors follow the current appearance.
const statusColors = () =>
	({
		orange: systemColors.orange,
		secondary: colors.secondaryLabel,
		green: systemColors.green
	}) as const;

function Count({
	value,
	icon,
	tint,
	label,
	highlight
}: {
	value: string;
	icon: string;
	tint: string;
	label: string;
	highlight?: string;
}) {
	return (
		<View
			accessible
			accessibilityLabel={`${label}: ${value}`}
			style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
		>
			<Icon name={icon} size={12} color={tint} />
			<Text
				style={[
					m3Type.titleSmall,
					{ color: highlight ?? colors.label, fontVariant: ['tabular-nums'] }
				]}
			>
				{value}
			</Text>
		</View>
	);
}

function RingGauge({
	title,
	percent,
	tint,
	revealed
}: {
	title: string;
	percent: number | undefined;
	tint: string;
	revealed: boolean;
}) {
	const value = Math.min(Math.max(percent ?? 0, 0), 100);
	return (
		<View
			accessible
			accessibilityLabel={title}
			accessibilityValue={{
				text: percent === undefined ? 'Unavailable' : `${Math.round(percent)} percent`
			}}
			style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
		>
			<MetricRing progress={(revealed ? value : 0) / 100} tint={tint} size={18} lineWidth={3} />
			<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{title}</Text>
			<Text style={[m3Type.titleSmall, { color: colors.label, fontVariant: ['tabular-nums'] }]}>
				{ringValueText(percent)}
			</Text>
		</View>
	);
}

export function EnvironmentRow(props: EnvironmentRowProps) {
	const { environment, dockerInfo, isActive, allEnvironmentsPreview, onOpen, onRefresh } = props;
	const row = useEnvironmentRow(environment, dockerInfo, onRefresh);
	const [menuOpen, setMenuOpen] = useState(false);
	const [gaugesRevealed, setGaugesRevealed] = useState(() => {
		const seen = revealedEnvironmentIDs.has(environment.id);
		revealedEnvironmentIDs.add(environment.id);
		return seen;
	});
	useEffect(() => {
		if (gaugesRevealed) return;
		const timer = setTimeout(() => setGaugesRevealed(true), 200);
		return () => clearTimeout(timer);
	}, [gaugesRevealed]);

	const name = environment.name ?? environment.id;
	const borderColor = allEnvironmentsPreview && row.colorHex ? parseHex(row.colorHex) : undefined;

	return (
		<View>
			<GlassCard
				isHighlighted={isActive && !allEnvironmentsPreview}
				style={[{ overflow: 'hidden' }, borderColor ? { borderWidth: 1.5, borderColor } : null]}
			>
				<Pressable
					onPress={onOpen}
					onLongPress={() => setMenuOpen(true)}
					android_ripple={{ color: colors.separator as string }}
					accessibilityRole="button"
					accessibilityHint="Opens system details. Hold for actions."
					style={{ padding: 16, gap: 16, borderRadius: Radius.card }}
				>
					<View style={{ gap: 4 }} accessible accessibilityLabel={`${name}, ${row.subtitle}`}>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
							<View
								style={{
									width: 8,
									height: 8,
									borderRadius: 4,
									backgroundColor: statusColors()[row.statusTint]
								}}
							/>
							<Text
								numberOfLines={1}
								ellipsizeMode="middle"
								style={[m3Type.titleMedium, { flexShrink: 1, color: colors.label }]}
							>
								{name}
							</Text>
							<View style={{ flex: 1, minWidth: 10 }} />
							<View style={{ flexDirection: 'row', gap: 10 }}>
								<Count
									value={row.updatesText}
									icon="arrow.triangle.2.circlepath"
									tint={systemColors.green}
									label="Updates"
								/>
								<Count
									value={row.containersText}
									icon="cube.box.fill"
									tint={systemColors.orange}
									label="Containers"
								/>
								<Count
									value={row.imagesText}
									icon="square.3.layers.3d.top.filled"
									tint={systemColors.purple}
									label="Images"
								/>
								<Count
									value={row.vulnerabilitiesText}
									icon="exclamationmark.shield.fill"
									tint={
										row.vulnerabilities > 0 ? systemColors.red : (colors.secondaryLabel as string)
									}
									label="Vulnerabilities"
									highlight={row.vulnerabilities > 0 ? systemColors.red : undefined}
								/>
							</View>
						</View>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18 }}>
							<Text
								numberOfLines={1}
								style={[
									m3Type.bodySmall,
									{
										fontFamily: monoFamily,
										color: row.streamError ? systemColors.orange : colors.secondaryLabel
									}
								]}
							>
								{row.subtitle}
							</Text>
							{row.isSyncing ? (
								<Icon
									name="arrow.triangle.2.circlepath"
									size={12}
									color={colors.secondaryLabel}
									accessibilityLabel="Syncing"
								/>
							) : null}
						</View>
					</View>
					<View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
						<RingGauge
							title="CPU"
							percent={row.cpuPercent}
							tint={systemColors.blue}
							revealed={gaugesRevealed}
						/>
						<RingGauge
							title="Memory"
							percent={row.memoryPercent}
							tint={systemColors.purple}
							revealed={gaugesRevealed}
						/>
						<RingGauge
							title="Disk"
							percent={row.diskPercent}
							tint={systemColors.teal}
							revealed={gaugesRevealed}
						/>
					</View>
				</Pressable>
			</GlassCard>
			<MaterialMenu
				expanded={menuOpen}
				onDismiss={() => setMenuOpen(false)}
				entries={[
					...(allEnvironmentsPreview
						? [
								{
									kind: 'item' as const,
									id: 'color',
									title: 'Environment Color',
									onPress: props.onColor
								}
							]
						: []),
					...(!isActive && !allEnvironmentsPreview
						? [
								{
									kind: 'item' as const,
									id: 'use',
									title: 'Use Environment',
									onPress: props.onUseEnvironment
								}
							]
						: []),
					{ kind: 'item', id: 'details', title: 'View Details', onPress: onOpen },
					{ kind: 'divider', id: 'divider' },
					{
						kind: 'item',
						id: 'sync',
						title: 'Sync',
						disabled: row.isSyncing,
						onPress: () => void row.sync()
					},
					...(row.canUpgrade
						? [
								{
									kind: 'item' as const,
									id: 'upgrade',
									title: 'Upgrade Arcane',
									onPress: props.onUpgrade
								}
							]
						: []),
					...(row.canPrune
						? [
								{
									kind: 'item' as const,
									id: 'prune',
									title: 'System Prune',
									destructive: true,
									onPress: props.onPrune
								}
							]
						: [])
				]}
			/>
		</View>
	);
}
