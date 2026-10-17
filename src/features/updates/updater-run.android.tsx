/**
 * Android rendering of `UpdaterRunSheet` / `UpdaterRunView` / `UpdaterRunItemRow`
 * (UpdaterRunView.swift): Material 3 sheet content with the same phases,
 * counters, and result list. Present inside a `MaterialSheet`.
 *
 * Standalone (RN views).
 */
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';

import { EnvironmentUpdateScene } from '@/features/environments/environment-update-scene';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { UpdaterResourceResult, UpdaterResult } from '@/sdk/models/updater/Updater';
import { environmentDisplayName } from '@/stores/environments-store';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { useReduceMotion } from '@/ui/components/accessibility';
import { m3 } from '@/ui/components/material-colors';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import {
	capitalized,
	resourceTypeIcon,
	resourceTypeTint,
	resultImageChange,
	updaterStatusText,
	updaterStatusTint
} from './updates-logic';
import { SheetHeader } from './android-sheet-header';
import { useUpdaterRun } from './use-updater-run';

export function EnvironmentPickerRow({
	environment,
	onPress
}: {
	environment: Environment;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				minHeight: 64,
				paddingHorizontal: 16,
				paddingVertical: 8
			}}
		>
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>
					{environmentDisplayName(environment)}
				</Text>
				<Text
					style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
					numberOfLines={1}
					ellipsizeMode="middle"
				>
					{environment.apiUrl}
				</Text>
			</View>
			<ResourceStatusBadge status={environment.status} usesCardStyle />
		</Pressable>
	);
}

export function UpdaterRunSheet({
	environments,
	initialEnvironmentID,
	onDismiss
}: {
	environments: Environment[];
	initialEnvironmentID?: string;
	onDismiss: () => void;
}) {
	const [selectedEnvironmentID, setSelectedEnvironmentID] = useState(initialEnvironmentID);
	if (selectedEnvironmentID !== undefined) {
		return (
			<UpdaterRunView
				key={selectedEnvironmentID}
				environmentID={selectedEnvironmentID}
				onDismiss={onDismiss}
			/>
		);
	}
	return (
		<View style={{ paddingBottom: 24 }}>
			<SheetHeader title="Run Updater" actionTitle="Cancel" onAction={onDismiss} />
			{environments.length === 0 ? (
				<View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
					<Icon name="server.rack" size={44} color={colors.secondaryLabel} />
					<Text style={[m3Type.titleLarge, { color: colors.label }]}>No Environments</Text>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
						Add an environment before running the updater.
					</Text>
				</View>
			) : (
				<View>
					<MaterialListGroup>
						{environments.map((environment) => (
							<EnvironmentPickerRow
								key={environment.id}
								environment={environment}
								onPress={() => setSelectedEnvironmentID(environment.id)}
							/>
						))}
					</MaterialListGroup>
					<Text
						style={[
							m3Type.bodySmall,
							{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
						]}
					>
						Pick an environment to run the container updater on.
					</Text>
				</View>
			)}
		</View>
	);
}

function CardHeader({ title, icon, tint }: { title: string; icon: string; tint: string }) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			<Icon name={icon} size={18} color={tint} />
			<Text style={[m3Type.titleMedium, { color: colors.label, flex: 1 }]}>{title}</Text>
		</View>
	);
}

function Card({ children }: { children: React.ReactNode }) {
	return (
		<View
			style={{
				padding: 20,
				gap: 14,
				borderRadius: Radius.card,
				backgroundColor: m3.surfaceContainerHigh,
				alignSelf: 'stretch'
			}}
		>
			{children}
		</View>
	);
}

function CounterTile({
	label,
	value,
	icon,
	tint
}: {
	label: string;
	value: number;
	icon: string;
	tint: string;
}) {
	return (
		<View
			style={{
				flex: 1,
				gap: 6,
				padding: 16,
				borderRadius: Radius.standard,
				backgroundColor: withOpacity(tint, 0.1)
			}}
		>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
				<Icon name={icon} size={14} color={tint} />
				<Text style={[m3Type.labelMedium, { color: colors.secondaryLabel }]} numberOfLines={1}>
					{label}
				</Text>
			</View>
			<Text
				style={[
					m3Type.headlineSmall,
					{ color: colors.label, fontWeight: '700', fontVariant: ['tabular-nums'] }
				]}
			>
				{value}
			</Text>
		</View>
	);
}

function SpinningIcon({ tint }: { tint: string }) {
	const reduceMotion = useReduceMotion();
	const rotation = useSharedValue(0);
	useEffect(() => {
		if (reduceMotion) return;
		rotation.value = withRepeat(
			withTiming(360, { duration: 1200, easing: Easing.linear }),
			-1,
			false
		);
		return () => cancelAnimation(rotation);
	}, [reduceMotion, rotation]);
	const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
	return (
		<View
			style={{
				width: 22,
				height: 22,
				borderRadius: 11,
				backgroundColor: withOpacity(tint, 0.15),
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			<Animated.View style={style}>
				<Icon name="arrow.triangle.2.circlepath" size={12} color={tint} />
			</Animated.View>
		</View>
	);
}

function Separator() {
	return <View style={{ height: 1, backgroundColor: colors.separator }} />;
}

function IdListCard({
	title,
	icon,
	tint,
	ids
}: {
	title: string;
	icon: string;
	tint: string;
	ids: string[];
}) {
	return (
		<Card>
			<CardHeader title={title} icon={icon} tint={tint} />
			<View>
				{ids.map((id, index) => (
					<View key={`${index}`}>
						<View
							style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
						>
							<SpinningIcon tint={tint} />
							<Text
								selectable
								style={[m3Type.bodySmall, { color: colors.label, fontFamily: monoFamily, flex: 1 }]}
								numberOfLines={1}
								ellipsizeMode="middle"
							>
								{id}
							</Text>
						</View>
						{index < ids.length - 1 ? <Separator /> : null}
					</View>
				))}
			</View>
		</Card>
	);
}

function UpdaterRunItemRow({ item }: { item: UpdaterResourceResult }) {
	const change = resultImageChange(item);
	const statusTint = updaterStatusTint(item, true);
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<RowIcon
				systemImage={resourceTypeIcon(item.resourceType)}
				tint={resourceTypeTint(item.resourceType)}
			/>
			<View style={{ flex: 1, gap: 3 }}>
				<Text
					style={[m3Type.titleSmall, { color: colors.label }]}
					numberOfLines={1}
					ellipsizeMode="middle"
				>
					{item.resourceName ?? item.resourceId}
				</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{capitalized(item.resourceType)}
				</Text>
				{change !== undefined ? (
					<Text
						style={[m3Type.labelSmall, { color: colors.tertiaryLabel, fontFamily: monoFamily }]}
						numberOfLines={1}
						ellipsizeMode="middle"
					>
						{change}
					</Text>
				) : null}
				{item.error !== undefined && item.error !== '' ? (
					<Text style={[m3Type.labelSmall, { color: systemColors.red }]} numberOfLines={2}>
						{item.error}
					</Text>
				) : null}
			</View>
			<Text
				style={[
					m3Type.labelSmall,
					{
						color: statusTint,
						fontWeight: '700',
						paddingHorizontal: 8,
						paddingVertical: 3,
						borderRadius: 999,
						overflow: 'hidden',
						backgroundColor: withOpacity(statusTint, 0.15)
					}
				]}
			>
				{updaterStatusText(item)}
			</Text>
		</View>
	);
}

function ResultCards({ result }: { result: UpdaterResult }) {
	return (
		<>
			<Card>
				<CardHeader title="Summary" icon="chart.bar.fill" tint={systemColors.purple} />
				<View style={{ flexDirection: 'row', gap: 12 }}>
					<CounterTile
						label="Checked"
						value={result.checked}
						icon="magnifyingglass"
						tint={systemColors.blue}
					/>
					<CounterTile
						label="Updated"
						value={result.updated}
						icon="checkmark.circle.fill"
						tint={systemColors.green}
					/>
				</View>
				<View style={{ flexDirection: 'row', gap: 12 }}>
					<CounterTile
						label="Skipped"
						value={result.skipped}
						icon="minus.circle.fill"
						tint={systemColors.gray}
					/>
					<CounterTile
						label="Failed"
						value={result.failed}
						icon="xmark.circle.fill"
						tint={systemColors.red}
					/>
				</View>
			</Card>
			{result.items.length > 0 ? (
				<Card>
					<CardHeader
						title={`Resources (${result.items.length})`}
						icon="list.bullet.rectangle.portrait"
						tint={systemColors.indigo}
					/>
					<View>
						{result.items.map((item, index) => (
							<View key={`${index}`}>
								<View style={{ paddingVertical: 10 }}>
									<UpdaterRunItemRow item={item} />
								</View>
								{index < result.items.length - 1 ? <Separator /> : null}
							</View>
						))}
					</View>
				</Card>
			) : null}
		</>
	);
}

export function UpdaterRunView({
	environmentID,
	onDismiss
}: {
	environmentID: string;
	onDismiss: () => void;
}) {
	const model = useUpdaterRun(environmentID);
	const { phase, liveStatus } = model;

	// `interactiveDismissDisabled(phase == .starting)`: swallow Back while starting.
	useEffect(() => {
		if (phase.kind !== 'starting') return;
		const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
		return () => subscription.remove();
	}, [phase.kind]);

	return (
		<View>
			<SheetHeader title="Run Updater" actionTitle={model.doneTitle} onAction={onDismiss} />
			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingVertical: 20,
					gap: 24,
					alignItems: 'center'
				}}
			>
				<View style={{ width: '100%', maxWidth: 680, gap: 24, alignItems: 'stretch' }}>
					<EnvironmentUpdateScene model={model.scene} />
					{phase.kind === 'running' && liveStatus ? (
						<>
							<Card>
								<CardHeader title="In Progress" icon="chart.bar.fill" tint={systemColors.purple} />
								<View style={{ flexDirection: 'row', gap: 12 }}>
									<CounterTile
										label="Containers"
										value={liveStatus.updatingContainers}
										icon="shippingbox.fill"
										tint={systemColors.blue}
									/>
									<CounterTile
										label="Projects"
										value={liveStatus.updatingProjects}
										icon="folder.fill"
										tint={systemColors.purple}
									/>
								</View>
							</Card>
							{liveStatus.containerIds.length > 0 ? (
								<IdListCard
									title="Containers Updating"
									icon="shippingbox.fill"
									tint={systemColors.blue}
									ids={liveStatus.containerIds}
								/>
							) : null}
							{liveStatus.projectIds.length > 0 ? (
								<IdListCard
									title="Projects Updating"
									icon="folder.fill"
									tint={systemColors.purple}
									ids={liveStatus.projectIds}
								/>
							) : null}
						</>
					) : null}
					{phase.kind === 'completed' ? <ResultCards result={phase.result} /> : null}
					{phase.kind === 'failed' ? (
						<Pressable
							onPress={model.retry}
							accessibilityRole="button"
							android_ripple={{ color: colors.separator as string }}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'center',
								gap: 8,
								minHeight: 48,
								borderRadius: 24,
								borderWidth: 1,
								borderColor: m3.outline
							}}
						>
							<Icon name="arrow.clockwise" size={18} color={m3.primary} />
							<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Try Again</Text>
						</Pressable>
					) : null}
				</View>
			</ScrollView>
		</View>
	);
}
