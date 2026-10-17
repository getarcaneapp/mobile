import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	Divider,
	HStack,
	Label,
	NavigationStack,
	ScrollView,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	Animation,
	animation,
	buttonStyle,
	contentTransition,
	controlSize,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	navigationTitle,
	onGeometryChange,
	padding,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { relativeNamed } from '@/features/dashboard/use-all-environments-dashboard';
import type { EnvironmentUpdateJob } from '@/sdk/models/system/Upgrade';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { useReduceMotion } from '@/ui/components/accessibility';
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
	const accent = useAccentColor();
	const route = useUpdateAllEnvironmentsRoute();
	const model = useUpdateAllEnvironments({
		environmentCount: environmentCount ?? route.environmentCount,
		startsImmediately
	});
	const [viewportHeight, setViewportHeight] = useState(0);

	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ gestureEnabled: !model.interactiveDismissDisabled }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<ScrollView
							modifiers={[
								navigationTitle('Update All'),
								navigationBarTitleDisplayMode('inline'),
								onGeometryChange((f) => setViewportHeight(f.height))
							]}
						>
							<VStack
								spacing={32}
								modifiers={[
									frame({ maxWidth: 680 }),
									padding({ horizontal: 20, vertical: 20 }),
									frame({ maxWidth: Infinity }),
									frame({ minHeight: viewportHeight, alignment: 'center' })
								]}
							>
								{!model.isAdmin ? (
									<ContentUnavailableView
										title="Admins Only"
										systemImage="lock.shield"
										description="Updating all environments requires an administrator account."
										modifiers={[frame({ maxWidth: Infinity, minHeight: 240 })]}
									/>
								) : (
									<PhaseContent model={model} />
								)}
							</VStack>
						</ScrollView>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label={model.doneTitle}
									onPress={() => router.back()}
									modifiers={[foregroundStyle(accent)]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}

function PhaseContent({ model }: { model: UpdateAllEnvironmentsModel }) {
	const reduceMotion = useReduceMotion();
	const { phase, sceneModel } = model;

	if (sceneModel) {
		return (
			<VStack spacing={24}>
				<EnvironmentUpdateScene model={sceneModel} />
				<VStack
					modifiers={
						reduceMotion ? [] : [animation(Animation.smooth({ duration: 0.25 }), model.phaseKey)]
					}
				>
					{phase.kind === 'ready' ? (
						<ReadyDetails lastJob={phase.lastJob} onTrigger={model.trigger} />
					) : null}
					{phase.kind === 'finished' ? <FinishedDetails job={phase.job} /> : null}
				</VStack>
			</VStack>
		);
	}
	if (phase.kind === 'unsupported') {
		return (
			<ContentUnavailableView
				title="Not Available"
				systemImage="lock.shield"
				description={phase.message}
				modifiers={[frame({ maxWidth: Infinity, minHeight: 240 })]}
			/>
		);
	}
	if (phase.kind === 'failed') {
		return (
			<VStack spacing={20}>
				<ContentUnavailableView
					title="Update All Failed"
					systemImage="exclamationmark.triangle"
					description={phase.message}
					modifiers={[
						fixedSize({ horizontal: false, vertical: true }),
						frame({ maxWidth: Infinity, minHeight: 240 })
					]}
				/>
				<Button onPress={model.retry} modifiers={[buttonStyle('bordered'), controlSize('large')]}>
					<Label
						title="Try Again"
						systemImage="arrow.clockwise"
						modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 6 })]}
					/>
				</Button>
			</VStack>
		);
	}
	return null;
}

function ReadyDetails({
	lastJob,
	onTrigger
}: {
	lastJob: EnvironmentUpdateJob | undefined;
	onTrigger: () => void;
}) {
	return (
		<VStack spacing={18}>
			{lastJob ? <LastRunRow job={lastJob} /> : null}

			<Text
				modifiers={[
					font({ textStyle: 'footnote' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
					multilineTextAlignment('center'),
					fixedSize({ horizontal: false, vertical: true }),
					padding({ horizontal: 12 })
				]}
			>
				Remote agents update first. The manager restarts last and can briefly interrupt the
				connection.
			</Text>

			<Button
				role="destructive"
				onPress={onTrigger}
				modifiers={[buttonStyle('borderedProminent'), controlSize('large'), tint(systemColors.red)]}
			>
				<Label
					title="Update All"
					systemImage="arrow.up.circle.fill"
					modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 8 })]}
				/>
			</Button>
		</VStack>
	);
}

function LastRunRow({ job }: { job: EnvironmentUpdateJob }) {
	const completed = job.status === 'completed';
	const completedAt = job.completedAt ? Date.parse(job.completedAt) : Number.NaN;
	return (
		<VStack spacing={0}>
			<Divider />
			<HStack spacing={12} modifiers={[padding({ vertical: 16 })]}>
				<Image
					systemName={completed ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
					modifiers={[
						font({ textStyle: 'title3' }),
						foregroundStyle(completed ? systemColors.green : systemColors.orange)
					]}
				/>
				<VStack alignment="leading" spacing={2}>
					<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>Last run</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(1)
						]}
					>
						{lastRunSummary(job)}
					</Text>
				</VStack>
				<Spacer minLength={8} />
				{Number.isFinite(completedAt) ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
						]}
					>
						{relativeNamed(completedAt)}
					</Text>
				) : null}
			</HStack>
			<Divider />
		</VStack>
	);
}

function FinishedDetails({ job }: { job: EnvironmentUpdateJob }) {
	const counts = resultCounts(resultsInProcessingOrder(job.results ?? []));
	return (
		<VStack spacing={0}>
			<Divider />
			<HStack spacing={0} modifiers={[padding({ vertical: 16 })]}>
				<CounterMetric label="Updated" value={counts.updated} tint={systemColors.green} />
				<Divider modifiers={[frame({ height: 56 })]} />
				<CounterMetric label="Failed" value={counts.failed} tint={systemColors.red} />
				<Divider modifiers={[frame({ height: 56 })]} />
				<CounterMetric label="Skipped" value={counts.skipped} tint={systemColors.gray} />
			</HStack>
			<Divider />
		</VStack>
	);
}

function CounterMetric({
	label,
	value,
	tint: color
}: {
	label: string;
	value: number;
	tint: string;
}) {
	return (
		<VStack spacing={4} modifiers={[frame({ maxWidth: Infinity })]}>
			<Text
				modifiers={[
					font({ textStyle: 'title', design: 'rounded', weight: 'semibold' }),
					foregroundStyle(color),
					contentTransition('numericText')
				]}
			>
				{String(value)}
			</Text>
			<Text
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
					lineLimit(1)
				]}
			>
				{label}
			</Text>
		</VStack>
	);
}
