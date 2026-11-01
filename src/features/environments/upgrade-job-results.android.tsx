import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { EnvironmentUpdateResult } from '@/sdk/models/system/Upgrade';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	upgradeResultDetail,
	upgradeResultIsManager,
	upgradeResultLabel,
	upgradeResultSymbol,
	upgradeResultTint,
	type UpgradeResultTint
} from './upgrade-job-display';
import { resultLogs } from './upgrade-job-follow';
import type {
	UpdateTargetPickerProps,
	UpgradeJobResultListProps,
	UpgradeLogsProps
} from './upgrade-job-results.types';

const cardStyle = {
	backgroundColor: colors.secondarySystemGroupedBackground,
	borderRadius: Radius.card,
	borderCurve: 'continuous' as const,
	paddingHorizontal: 16,
	paddingVertical: 4,
	overflow: 'hidden' as const
};

function tintColor(value: UpgradeResultTint): string {
	switch (value) {
		case 'accent':
			return m3.primary as string;
		case 'green':
			return systemColors.green;
		case 'orange':
			return systemColors.orange;
		case 'red':
			return systemColors.red;
		case 'gray':
			return systemColors.gray;
	}
}

function ManagerChip() {
	return (
		<View
			style={{
				paddingHorizontal: 6,
				paddingVertical: 1,
				borderRadius: 8,
				borderWidth: 1,
				borderColor: m3.outline
			}}
		>
			<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>Manager</Text>
		</View>
	);
}

function Separator() {
	return <View style={{ height: 1, backgroundColor: colors.separator }} />;
}

export function UpgradeLogs({ logs, maxHeight = 220 }: UpgradeLogsProps) {
	const text = resultLogs(logs);
	const scroll = useRef<ScrollViewInstance>(null);
	if (!text) {
		return <Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>No logs yet</Text>;
	}
	return (
		<ScrollView
			ref={scroll}
			nestedScrollEnabled
			onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
			style={{
				maxHeight,
				borderRadius: Radius.nested,
				backgroundColor: withOpacity(systemColors.gray, 0.12)
			}}
			contentContainerStyle={{ padding: 12 }}
		>
			<Text selectable style={{ fontFamily: monoFamily, fontSize: 11, color: colors.label }}>
				{text}
			</Text>
		</ScrollView>
	);
}

function ProgressBar({ fraction, color }: { fraction: number; color: string }) {
	const value = useSharedValue(fraction);
	useEffect(() => {
		value.set(withTiming(fraction, { duration: 300 }));
	}, [value, fraction]);
	const fill = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));
	return (
		<View
			style={{
				flex: 1,
				height: 4,
				borderRadius: 2,
				overflow: 'hidden',
				backgroundColor: withOpacity(color, 0.24)
			}}
		>
			<Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: color }, fill]} />
		</View>
	);
}

function ResultRow({
	result,
	expandsLogs
}: {
	result: EnvironmentUpdateResult;
	expandsLogs: boolean;
}) {
	const color = tintColor(upgradeResultTint(result));
	const [showsLogs, setShowsLogs] = useState(expandsLogs);
	const detail = upgradeResultDetail(result);
	const percent = Math.max(0, Math.min(100, result.percent ?? 0));
	return (
		<View style={{ paddingVertical: 12, gap: 10 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
				<Icon name={upgradeResultSymbol(result)} size={22} color={color} />
				<View style={{ flex: 1, gap: 2 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
						<Text
							numberOfLines={1}
							style={[m3Type.titleSmall, { color: colors.label, flexShrink: 1 }]}
						>
							{result.environmentName || result.environmentId}
						</Text>
						{upgradeResultIsManager(result) ? <ManagerChip /> : null}
					</View>
					{detail ? (
						<Text
							numberOfLines={2}
							style={[
								m3Type.bodySmall,
								{ color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }
							]}
						>
							{detail}
						</Text>
					) : null}
				</View>
				<Text numberOfLines={1} style={[m3Type.labelMedium, { color }]}>
					{upgradeResultLabel(result)}
				</Text>
			</View>
			{result.status === 'updating' ? (
				<View
					accessible
					accessibilityRole="progressbar"
					accessibilityLabel={`${result.environmentName} progress`}
					accessibilityValue={{ min: 0, max: 100, now: percent }}
					style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
				>
					<ProgressBar fraction={percent / 100} color={color} />
					<Text
						style={[
							m3Type.bodySmall,
							{ color: colors.secondaryLabel, fontVariant: ['tabular-nums'], width: 36 }
						]}
					>
						{`${percent}%`}
					</Text>
				</View>
			) : null}
			<Pressable
				onPress={() => setShowsLogs(!showsLogs)}
				accessibilityRole="button"
				accessibilityState={{ expanded: showsLogs }}
				android_ripple={{ color: colors.separator as string }}
				style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}
			>
				<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Logs</Text>
				<Icon name={showsLogs ? 'chevron.up' : 'chevron.down'} size={16} color={m3.primary} />
			</Pressable>
			{showsLogs ? <UpgradeLogs logs={result.logs} /> : null}
		</View>
	);
}

export function UpgradeJobResultList({ results, expandsLogs = false }: UpgradeJobResultListProps) {
	return (
		<View style={cardStyle}>
			{results.map((result, index) => (
				<View key={result.environmentId}>
					{index > 0 ? <Separator /> : null}
					<ResultRow result={result} expandsLogs={expandsLogs || results.length === 1} />
				</View>
			))}
		</View>
	);
}

export function UpdateTargetPicker({
	candidates,
	selected,
	onToggle,
	onSelectAll,
	onSelectNone
}: UpdateTargetPickerProps) {
	const allSelected = selected.length === candidates.length;
	return (
		<View style={{ gap: 8 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<Text style={[m3Type.titleMedium, { color: colors.label, flex: 1 }]}>Environments</Text>
				<Pressable
					onPress={allSelected ? onSelectNone : onSelectAll}
					accessibilityRole="button"
					android_ripple={{ color: colors.separator as string, borderless: true }}
					style={{ paddingHorizontal: 12, paddingVertical: 8 }}
				>
					<Text style={[m3Type.labelLarge, { color: m3.primary }]}>
						{allSelected ? 'Select None' : 'Select All'}
					</Text>
				</Pressable>
			</View>
			<View style={cardStyle}>
				{candidates.map((candidate, index) => {
					const isSelected = selected.includes(candidate.id);
					const status = !candidate.online
						? 'Offline'
						: candidate.updateAvailable
							? 'Update Available'
							: candidate.updateAvailable === false
								? 'Up to Date'
								: '';
					return (
						<View key={candidate.id}>
							{index > 0 ? <Separator /> : null}
							<Pressable
								onPress={() => onToggle(candidate.id)}
								accessibilityRole="checkbox"
								accessibilityState={{ checked: isSelected }}
								accessibilityLabel={candidate.name}
								android_ripple={{ color: colors.separator as string }}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 12,
									paddingVertical: 12
								}}
							>
								<Icon
									name={isSelected ? 'checkmark.square.fill' : 'square'}
									size={24}
									color={isSelected ? m3.primary : colors.secondaryLabel}
								/>
								<View style={{ flex: 1, gap: 2 }}>
									<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
										<Text
											numberOfLines={1}
											style={[m3Type.titleSmall, { color: colors.label, flexShrink: 1 }]}
										>
											{candidate.name}
										</Text>
										{candidate.isManager ? <ManagerChip /> : null}
									</View>
									{candidate.version ? (
										<Text
											numberOfLines={1}
											style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
										>
											{candidate.version}
										</Text>
									) : null}
								</View>
								{status ? (
									<Text
										numberOfLines={1}
										style={[
											m3Type.labelMedium,
											{
												color: !candidate.online
													? systemColors.gray
													: candidate.updateAvailable
														? systemColors.green
														: colors.secondaryLabel
											}
										]}
									>
										{status}
									</Text>
								) : null}
							</Pressable>
						</View>
					);
				})}
			</View>
		</View>
	);
}
