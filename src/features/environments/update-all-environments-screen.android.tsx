import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';

import { relativeNamed } from '@/features/dashboard/use-all-environments-dashboard';
import type { EnvironmentUpdateJob } from '@/sdk/models/system/Upgrade';
import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { ToastHost } from '@/ui/toast';

import { EnvironmentUpdateScene } from './environment-update-scene';
import {
	lastRunSummary,
	resultCounts,
	resultsInProcessingOrder,
	useUpdateAllEnvironments,
	useUpdateAllEnvironmentsRoute,
	type UpdateAllEnvironmentsModel
} from './update-all-environments-model';
import type { UpdateAllEnvironmentsScreenProps } from './update-all-environments-screen.types';

export function UpdateAllEnvironmentsScreen({
	environmentCount,
	startsImmediately = true
}: UpdateAllEnvironmentsScreenProps) {
	const router = useRouter();
	const route = useUpdateAllEnvironmentsRoute();
	const model = useUpdateAllEnvironments({
		environmentCount: environmentCount ?? route.environmentCount,
		startsImmediately
	});

	const blocksDismiss = model.interactiveDismissDisabled;
	useEffect(() => {
		if (!blocksDismiss) return;
		const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
		return () => sub.remove();
	}, [blocksDismiss]);

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
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
			<ScrollView
				contentContainerStyle={{
					flexGrow: 1,
					justifyContent: 'center',
					alignItems: 'center',
					padding: 20
				}}
			>
				<View style={{ width: '100%', maxWidth: 680, gap: 32 }}>
					{!model.isAdmin ? (
						<CenteredUnavailable
							icon="lock.shield"
							title="Admins Only"
							message="Updating all environments requires an administrator account."
						/>
					) : (
						<PhaseContent model={model} />
					)}
				</View>
			</ScrollView>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}

function CenteredUnavailable({
	icon,
	title,
	message
}: {
	icon: string;
	title: string;
	message: string;
}) {
	return (
		<View
			style={{
				minHeight: 240,
				alignItems: 'center',
				justifyContent: 'center',
				gap: 8,
				paddingHorizontal: 12
			}}
		>
			<Icon name={icon} size={44} color={colors.secondaryLabel} />
			<Text
				style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center', fontWeight: '600' }]}
			>
				{title}
			</Text>
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
				{message}
			</Text>
		</View>
	);
}

function PhaseContent({ model }: { model: UpdateAllEnvironmentsModel }) {
	const { phase, sceneModel } = model;
	if (sceneModel) {
		return (
			<View style={{ gap: 24 }}>
				<EnvironmentUpdateScene model={sceneModel} />
				{phase.kind === 'ready' ? (
					<ReadyDetails lastJob={phase.lastJob} onTrigger={model.trigger} />
				) : null}
				{phase.kind === 'finished' ? <FinishedDetails job={phase.job} /> : null}
			</View>
		);
	}
	if (phase.kind === 'unsupported') {
		return <CenteredUnavailable icon="lock.shield" title="Not Available" message={phase.message} />;
	}
	if (phase.kind === 'failed') {
		return (
			<View style={{ gap: 20 }}>
				<CenteredUnavailable
					icon="exclamationmark.triangle"
					title="Update All Failed"
					message={phase.message}
				/>
				<Pressable
					onPress={model.retry}
					accessibilityRole="button"
					android_ripple={{ color: colors.separator as string }}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 8,
						height: 48,
						borderRadius: 24,
						borderWidth: 1,
						borderColor: m3.outline,
						overflow: 'hidden'
					}}
				>
					<Icon name="arrow.clockwise" size={18} color={m3.primary} />
					<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Try Again</Text>
				</Pressable>
			</View>
		);
	}
	return null;
}

function Divider() {
	return <View style={{ height: 1, backgroundColor: colors.separator }} />;
}

function ReadyDetails({
	lastJob,
	onTrigger
}: {
	lastJob: EnvironmentUpdateJob | undefined;
	onTrigger: () => void;
}) {
	return (
		<View style={{ gap: 18 }}>
			{lastJob ? <LastRunRow job={lastJob} /> : null}
			<Text
				style={[
					m3Type.bodySmall,
					{ color: colors.secondaryLabel, textAlign: 'center', paddingHorizontal: 12 }
				]}
			>
				Remote agents update first. The manager restarts last and can briefly interrupt the
				connection.
			</Text>
			<Pressable
				onPress={onTrigger}
				accessibilityRole="button"
				android_ripple={{ color: '#FFFFFF33' }}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 8,
					height: 52,
					borderRadius: 26,
					backgroundColor: m3.error,
					overflow: 'hidden'
				}}
			>
				<Icon name="arrow.up.circle.fill" size={20} color="#FFFFFF" />
				<Text style={[m3Type.labelLarge, { color: '#FFFFFF' }]}>Update All</Text>
			</Pressable>
		</View>
	);
}

function LastRunRow({ job }: { job: EnvironmentUpdateJob }) {
	const completed = job.status === 'completed';
	const completedAt = job.completedAt ? Date.parse(job.completedAt) : Number.NaN;
	return (
		<View>
			<Divider />
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }}>
				<Icon
					name={completed ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
					size={22}
					color={completed ? systemColors.green : systemColors.orange}
				/>
				<View style={{ flex: 1, gap: 2 }}>
					<Text style={[m3Type.titleSmall, { color: colors.label }]}>Last run</Text>
					<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{lastRunSummary(job)}
					</Text>
				</View>
				{Number.isFinite(completedAt) ? (
					<Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel }]}>
						{relativeNamed(completedAt)}
					</Text>
				) : null}
			</View>
			<Divider />
		</View>
	);
}

function FinishedDetails({ job }: { job: EnvironmentUpdateJob }) {
	const counts = resultCounts(resultsInProcessingOrder(job.results ?? []));
	const vDivider = <View style={{ width: 1, height: 56, backgroundColor: colors.separator }} />;
	return (
		<View>
			<Divider />
			<View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }}>
				<CounterMetric label="Updated" value={counts.updated} tint={systemColors.green} />
				{vDivider}
				<CounterMetric label="Failed" value={counts.failed} tint={systemColors.red} />
				{vDivider}
				<CounterMetric label="Skipped" value={counts.skipped} tint={systemColors.gray} />
			</View>
			<Divider />
		</View>
	);
}

function CounterMetric({ label, value, tint }: { label: string; value: number; tint: string }) {
	return (
		<View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
			<Text
				style={[
					m3Type.headlineSmall,
					{ color: tint, fontWeight: '600', fontVariant: ['tabular-nums'] }
				]}
			>
				{String(value)}
			</Text>
			<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
				{label}
			</Text>
		</View>
	);
}
