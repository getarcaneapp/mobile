import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';

import { FlashList } from '@shopify/flash-list';

import type { EnvironmentUpdateResult } from '@/sdk/models/system/Upgrade';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialSectionHeader } from '@/ui/material/list';
import { ToastHost } from '@/ui/toast';

import {
	EnvironmentUpdateSceneKind,
	type EnvironmentUpdateSceneModel,
	type EnvironmentUpdateTint
} from './environment-update-scene.types';
import {
	useUpdateAllEnvironments,
	type RunCounts,
	type UpdateAllEnvironmentsModel
} from './update-all-environments-model';
import {
	upgradeResultDetail,
	upgradeResultIsManager,
	upgradeResultLabel,
	upgradeResultSymbol,
	upgradeResultTint
} from './upgrade-job-display';
import { ProgressBar, UpgradeLogs } from './upgrade-job-results.android';

function tintColor(value: EnvironmentUpdateTint): string {
	switch (value) {
		case 'accent':
			return m3.primary as string;
		case 'green':
			return systemColors.green;
		case 'orange':
			return systemColors.orange;
		case 'red':
			return m3.error as string;
		case 'gray':
			return systemColors.gray;
	}
}

type Entry =
	| { key: string; type: 'header'; title: string }
	| { key: string; type: 'environment'; result: EnvironmentUpdateResult; isFirst: boolean };

function entries(results: readonly EnvironmentUpdateResult[]): Entry[] {
	if (results.length === 0) return [];
	return [
		{ key: 'header', type: 'header', title: `Environments (${results.length})` },
		...results.map((result, index): Entry => ({
			key: result.environmentId,
			type: 'environment',
			result,
			isFirst: index === 0
		}))
	];
}

export function UpdateAllEnvironmentsScreen() {
	const router = useRouter();
	const model = useUpdateAllEnvironments();
	const [expandedID, setExpandedID] = useState<string | undefined>(undefined);

	const blocksDismiss = model.interactiveDismissDisabled;
	useEffect(() => {
		if (!blocksDismiss) return;
		const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
		return () => sub.remove();
	}, [blocksDismiss]);

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
			<Stack.Screen
				options={{ title: 'Update All', headerShown: true, gestureEnabled: !blocksDismiss }}
			/>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.View>
					<Pressable
						onPress={() => router.back()}
						disabled={blocksDismiss}
						accessibilityRole="button"
						style={{ paddingHorizontal: 12, paddingVertical: 8, opacity: blocksDismiss ? 0.38 : 1 }}
					>
						<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{model.doneTitle}</Text>
					</Pressable>
				</Stack.Toolbar.View>
			</Stack.Toolbar>
			<Content
				model={model}
				expandedID={expandedID}
				onToggle={(id) => setExpandedID(expandedID === id ? undefined : id)}
			/>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}

function Content({
	model,
	expandedID,
	onToggle
}: {
	model: UpdateAllEnvironmentsModel;
	expandedID: string | undefined;
	onToggle: (id: string) => void;
}) {
	const { phase, sceneModel } = model;
	if (!model.isAdmin) {
		return (
			<Unavailable
				icon="lock.shield"
				title="Admins Only"
				message="Updating all environments requires an administrator account."
			/>
		);
	}
	if (phase.kind === 'unsupported') {
		return <Unavailable icon="lock.shield" title="Not Available" message={phase.message} />;
	}
	if (phase.kind === 'failed' || !sceneModel) {
		return (
			<Unavailable
				icon="exclamationmark.triangle"
				title="Update All Failed"
				message={phase.kind === 'failed' ? phase.message : ''}
				action={{ title: 'Try Again', onPress: model.retry }}
			/>
		);
	}
	const results = model.jobResults;
	return (
		<FlashList
			data={entries(results)}
			extraData={expandedID}
			keyExtractor={(entry) => entry.key}
			getItemType={(entry) => entry.type}
			style={{ backgroundColor: colors.systemBackground }}
			contentContainerStyle={{ paddingBottom: 32 }}
			ListHeaderComponent={
				<SummaryCard scene={sceneModel} counts={results.length > 0 ? model.runCounts : undefined} />
			}
			ListFooterComponent={
				model.supportsJobs && model.failedIDs.length > 0 ? (
					<View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
						<TonalButton
							icon="arrow.clockwise"
							title={
								model.failedIDs.length === 1
									? 'Retry Failed'
									: `Retry ${model.failedIDs.length} Failed`
							}
							onPress={model.retryFailed}
						/>
					</View>
				) : null
			}
			renderItem={({ item: entry }) =>
				entry.type === 'header' ? (
					<MaterialSectionHeader title={entry.title} />
				) : (
					<EnvironmentRow
						result={entry.result}
						expanded={expandedID === entry.result.environmentId}
						showsDivider={!entry.isFirst}
						onPress={() => onToggle(entry.result.environmentId)}
					/>
				)
			}
		/>
	);
}

function Unavailable({
	icon,
	title,
	message,
	action
}: {
	icon: string;
	title: string;
	message: string;
	action?: { title: string; onPress: () => void };
}) {
	return (
		<View
			style={{
				flex: 1,
				alignItems: 'center',
				justifyContent: 'center',
				gap: 8,
				paddingHorizontal: 32
			}}
		>
			<Icon name={icon} size={44} color={colors.secondaryLabel} />
			<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
			{message ? (
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
					{message}
				</Text>
			) : null}
			{action ? (
				<View style={{ paddingTop: 16, alignSelf: 'stretch' }}>
					<TonalButton icon="arrow.clockwise" title={action.title} onPress={action.onPress} />
				</View>
			) : null}
		</View>
	);
}

function sceneIcon(scene: EnvironmentUpdateSceneModel): string {
	switch (scene.kind) {
		case 'completed':
			return 'checkmark.circle.fill';
		case 'failed':
			return 'xmark.circle.fill';
		case 'warning':
			return 'exclamationmark.triangle.fill';
		default:
			return EnvironmentUpdateSceneKind.symbol(scene.kind);
	}
}

function SummaryCard({
	scene,
	counts
}: {
	scene: EnvironmentUpdateSceneModel;
	counts: RunCounts | undefined;
}) {
	const color = tintColor(EnvironmentUpdateSceneKind.tint(scene.kind));
	const busy = scene.kind === 'loading' || scene.kind === 'starting';
	const terminal = EnvironmentUpdateSceneKind.isTerminal(scene.kind);
	const percent = scene.progress === undefined ? undefined : Math.round(scene.progress * 100);
	return (
		<View
			style={{
				paddingHorizontal: 16,
				paddingVertical: 12,
				gap: 16
			}}
		>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
				<View
					style={{
						width: 48,
						height: 48,
						borderRadius: 24,
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: withOpacity(color, 0.14)
					}}
				>
					{busy ? (
						<ActivityIndicator color={color} />
					) : (
						<Icon name={sceneIcon(scene)} size={26} color={color} />
					)}
				</View>
				<View style={{ flex: 1, gap: 2 }}>
					<Text numberOfLines={1} style={[m3Type.titleMedium, { color: colors.label }]}>
						{scene.title}
					</Text>
					<Text
						numberOfLines={3}
						style={[
							m3Type.bodyMedium,
							{ color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }
						]}
					>
						{scene.subtitle}
					</Text>
				</View>
				{percent !== undefined && !terminal ? (
					<Text
						style={[m3Type.titleMedium, { color, fontVariant: ['tabular-nums'] }]}
					>{`${percent}%`}</Text>
				) : null}
			</View>
			{percent !== undefined && !terminal ? (
				<View
					accessibilityRole="progressbar"
					accessibilityLabel={`${percent}% complete`}
					accessibilityValue={{ min: 0, max: 100, now: percent }}
					style={{ flexDirection: 'row' }}
				>
					<ProgressBar fraction={percent / 100} color={color} />
				</View>
			) : null}
			{counts ? (
				<View style={{ flexDirection: 'row' }}>
					<Count label="Updating" value={counts.updating} color={m3.primary as string} />
					<Count label="Pending" value={counts.pending} color={systemColors.gray} />
					<Count label="Done" value={counts.done} color={systemColors.green} />
					<Count label="Failed" value={counts.failed} color={m3.error as string} />
				</View>
			) : null}
		</View>
	);
}

function Count({ label, value, color }: { label: string; value: number; color: string }) {
	return (
		<View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
			<Text
				style={[
					m3Type.titleLarge,
					{
						color: value > 0 ? color : colors.tertiaryLabel,
						fontWeight: '600',
						fontVariant: ['tabular-nums']
					}
				]}
			>
				{String(value)}
			</Text>
			<Text numberOfLines={1} style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
				{label}
			</Text>
		</View>
	);
}

function EnvironmentRow({
	result,
	expanded,
	showsDivider,
	onPress
}: {
	result: EnvironmentUpdateResult;
	expanded: boolean;
	showsDivider: boolean;
	onPress: () => void;
}) {
	const color = tintColor(upgradeResultTint(result));
	const detail = upgradeResultDetail(result);
	const updating = result.status === 'updating';
	const percent = Math.max(0, Math.min(100, result.percent ?? 0));
	return (
		<View>
			{showsDivider ? (
				<View style={{ height: 1, marginLeft: 56, backgroundColor: colors.separator }} />
			) : null}
			<Pressable
				onPress={onPress}
				accessibilityRole="button"
				accessibilityState={{ expanded }}
				android_ripple={{ color: colors.separator as string }}
				style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
			>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
					<Icon name={upgradeResultSymbol(result)} size={24} color={color} />
					<View style={{ flex: 1, gap: 2 }}>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
							<Text
								numberOfLines={1}
								style={[m3Type.bodyLarge, { color: colors.label, flexShrink: 1 }]}
							>
								{result.environmentName || result.environmentId}
							</Text>
							{upgradeResultIsManager(result) ? (
								<Text
									style={[
										m3Type.labelSmall,
										{
											color: colors.secondaryLabel,
											paddingHorizontal: 6,
											paddingVertical: 1,
											borderRadius: 8,
											overflow: 'hidden',
											backgroundColor: withOpacity(systemColors.gray, 0.16)
										}
									]}
								>
									Manager
								</Text>
							) : null}
						</View>
						{detail ? (
							<Text
								numberOfLines={expanded ? undefined : 1}
								style={[
									m3Type.bodySmall,
									{ color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }
								]}
							>
								{detail}
							</Text>
						) : null}
					</View>
					<Text
						numberOfLines={1}
						style={[m3Type.labelMedium, { color, fontVariant: ['tabular-nums'] }]}
					>
						{updating && result.percent !== undefined
							? `${upgradeResultLabel(result)} · ${percent}%`
							: upgradeResultLabel(result)}
					</Text>
					<Icon
						name={expanded ? 'chevron.up' : 'chevron.down'}
						size={20}
						color={colors.secondaryLabel}
					/>
				</View>
				{updating ? (
					<View style={{ flexDirection: 'row', paddingLeft: 40 }}>
						<ProgressBar fraction={percent / 100} color={color} />
					</View>
				) : null}
				{expanded ? (
					<View style={{ paddingLeft: 40, paddingTop: 4 }}>
						<UpgradeLogs logs={result.logs} maxHeight={280} />
					</View>
				) : null}
			</Pressable>
		</View>
	);
}

function TonalButton({
	icon,
	title,
	onPress
}: {
	icon: string;
	title: string;
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
				justifyContent: 'center',
				gap: 8,
				height: 48,
				borderRadius: 24,
				backgroundColor: m3.secondaryContainer,
				overflow: 'hidden'
			}}
		>
			<Icon name={icon} size={18} color={m3.onSecondaryContainer} />
			<Text style={[m3Type.labelLarge, { color: m3.onSecondaryContainer }]}>{title}</Text>
		</Pressable>
	);
}
