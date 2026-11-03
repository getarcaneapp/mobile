import { Host } from '@/ui/host';
import {
	Button,
	Gauge,
	HStack,
	LabeledContent,
	List,
	NavigationDestination,
	NavigationLink,
	NavigationStack,
	ProgressView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	background,
	contentTransition,
	font,
	foregroundStyle,
	frame,
	gaugeStyle,
	lineLimit,
	listRowSeparator,
	listStyle,
	monospacedDigit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	shapes,
	textSelection,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { EnvironmentUpdateResult } from '@/sdk/models/system/Upgrade';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { UnavailableView } from '@/ui/components/unavailable-view';
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
import { resultLogs } from './upgrade-job-follow';

const secondary = { type: 'hierarchical', style: 'secondary' } as const;

function useTintColor(): (value: EnvironmentUpdateTint) => string {
	const accent = useAccentColor();
	return (value) => {
		switch (value) {
			case 'accent':
				return accent;
			case 'green':
				return systemColors.green;
			case 'orange':
				return systemColors.orange;
			case 'red':
				return systemColors.red;
			case 'gray':
				return systemColors.gray;
		}
	};
}

export function UpdateAllEnvironmentsScreen() {
	const router = useRouter();
	const accent = useAccentColor();
	const model = useUpdateAllEnvironments();
	const [path, setPath] = useState<string[]>([]);

	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ gestureEnabled: !model.interactiveDismissDisabled }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack path={path} onPathChange={setPath} modifiers={[tint(accent)]}>
					<Toolbar>
						<RootContent model={model} />
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label={model.doneTitle} onPress={() => router.back()} />
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
					{path.map((id) => {
						const result = model.jobResults.find((r) => r.environmentId === id);
						return result ? (
							<NavigationDestination key={id} value={id}>
								<EnvironmentDetail result={result} />
							</NavigationDestination>
						) : null;
					})}
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}

const rootTitle = [navigationTitle('Update All'), navigationBarTitleDisplayMode('inline')];

function RootContent({ model }: { model: UpdateAllEnvironmentsModel }) {
	const { phase, sceneModel } = model;
	if (!model.isAdmin) {
		return (
			<VStack modifiers={rootTitle}>
				<UnavailableView
					title="Admins Only"
					systemImage="lock.shield"
					description="Updating all environments requires an administrator account."
				/>
			</VStack>
		);
	}
	if (phase.kind === 'unsupported') {
		return (
			<VStack modifiers={rootTitle}>
				<UnavailableView
					title="Not Available"
					systemImage="lock.shield"
					description={phase.message}
				/>
			</VStack>
		);
	}
	if (phase.kind === 'failed' || !sceneModel) {
		return (
			<VStack modifiers={rootTitle}>
				<UnavailableView
					title="Update All Failed"
					systemImage="exclamationmark.triangle"
					description={phase.kind === 'failed' ? phase.message : undefined}
					actions={[{ title: 'Try Again', onPress: model.retry }]}
				/>
			</VStack>
		);
	}

	const results = model.jobResults;
	return (
		<List modifiers={[listStyle('plain'), ...rootTitle]}>
			<Section>
				<SummaryRow scene={sceneModel} />
				{results.length > 0 ? <CountsRow counts={model.runCounts} /> : null}
			</Section>
			{results.length > 0 ? (
				<Section title={`Environments (${results.length})`}>
					<List.ForEach
						data={results}
						keyExtractor={(result) => result.environmentId}
						estimatedItemSize={64}
					>
						{({ item }) => (
							<NavigationLink value={item.environmentId}>
								<EnvironmentRow result={item} />
							</NavigationLink>
						)}
					</List.ForEach>
				</Section>
			) : null}
			{model.supportsJobs && model.failedIDs.length > 0 ? (
				<Section>
					<Button
						onPress={model.retryFailed}
						label={
							model.failedIDs.length === 1
								? 'Retry Failed'
								: `Retry ${model.failedIDs.length} Failed`
						}
						systemImage="arrow.clockwise"
					/>
				</Section>
			) : null}
		</List>
	);
}

function SummaryRow({ scene }: { scene: EnvironmentUpdateSceneModel }) {
	const color = useTintColor()(EnvironmentUpdateSceneKind.tint(scene.kind));
	const busy = scene.kind === 'loading' || scene.kind === 'starting';
	const terminal = EnvironmentUpdateSceneKind.isTerminal(scene.kind);
	const percent = scene.progress === undefined ? undefined : Math.round(scene.progress * 100);
	return (
		<HStack spacing={16} modifiers={[padding({ vertical: 6 }), listRowSeparator('hidden')]}>
			<VStack modifiers={[frame({ width: 56, height: 56 })]}>
				{busy ? (
					<ProgressView />
				) : terminal || percent === undefined ? (
					<Image
						systemName={
							(scene.kind === 'completed'
								? 'checkmark.circle.fill'
								: scene.kind === 'failed'
									? 'xmark.circle.fill'
									: scene.kind === 'warning'
										? 'exclamationmark.triangle.fill'
										: EnvironmentUpdateSceneKind.symbol(scene.kind)) as never
						}
						modifiers={[font({ size: 40 }), foregroundStyle(color)]}
					/>
				) : (
					<Gauge
						value={percent / 100}
						currentValueLabel={
							<Text
								modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), monospacedDigit()]}
							>
								{`${percent}%`}
							</Text>
						}
						modifiers={[
							gaugeStyle('circularCapacity'),
							tint(color),
							accessibilityLabel(`${percent}% complete`)
						]}
					/>
				)}
			</VStack>
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>{scene.title}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle(secondary),
						monospacedDigit(),
						lineLimit(3)
					]}
				>
					{scene.subtitle}
				</Text>
			</VStack>
			<Spacer minLength={0} />
		</HStack>
	);
}

function CountsRow({ counts }: { counts: RunCounts }) {
	const accent = useAccentColor();
	return (
		<HStack spacing={0} modifiers={[padding({ vertical: 4 }), listRowSeparator('hidden')]}>
			<Count label="Updating" value={counts.updating} color={accent} />
			<Count label="Pending" value={counts.pending} color={systemColors.gray} />
			<Count label="Done" value={counts.done} color={systemColors.green} />
			<Count label="Failed" value={counts.failed} color={systemColors.red} />
		</HStack>
	);
}

function Count({ label, value, color }: { label: string; value: number; color: string }) {
	return (
		<VStack spacing={2} modifiers={[frame({ maxWidth: Infinity })]}>
			<Text
				modifiers={[
					font({ textStyle: 'title3', design: 'rounded', weight: 'semibold' }),
					foregroundStyle(value > 0 ? color : systemColors.gray),
					contentTransition('numericText')
				]}
			>
				{String(value)}
			</Text>
			<Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(secondary), lineLimit(1)]}>
				{label}
			</Text>
		</VStack>
	);
}

function ManagerBadge() {
	return (
		<Text
			modifiers={[
				font({ textStyle: 'caption2', weight: 'medium' }),
				foregroundStyle(secondary),
				padding({ horizontal: 6, vertical: 1 }),
				background(withOpacity(systemColors.gray, 0.16), shapes.capsule())
			]}
		>
			Manager
		</Text>
	);
}

function EnvironmentRow({ result }: { result: EnvironmentUpdateResult }) {
	const color = useTintColor()(upgradeResultTint(result));
	const detail = upgradeResultDetail(result);
	const updating = result.status === 'updating';
	const percent = Math.max(0, Math.min(100, result.percent ?? 0));
	return (
		<VStack alignment="leading" spacing={8} modifiers={[padding({ vertical: 2 })]}>
			<HStack spacing={12}>
				<Image
					systemName={upgradeResultSymbol(result) as never}
					modifiers={[font({ textStyle: 'title3' }), foregroundStyle(color), frame({ width: 28 })]}
				/>
				<VStack alignment="leading" spacing={2}>
					<HStack spacing={6}>
						<Text modifiers={[font({ textStyle: 'body' }), lineLimit(1)]}>
							{result.environmentName || result.environmentId}
						</Text>
						{upgradeResultIsManager(result) ? <ManagerBadge /> : null}
					</HStack>
					{detail ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle(secondary),
								monospacedDigit(),
								lineLimit(1)
							]}
						>
							{detail}
						</Text>
					) : null}
				</VStack>
				<Spacer minLength={8} />
				<Text
					modifiers={[
						font({ textStyle: 'footnote', weight: 'medium' }),
						foregroundStyle(color),
						monospacedDigit(),
						lineLimit(1)
					]}
				>
					{updating && result.percent !== undefined
						? `${upgradeResultLabel(result)} · ${percent}%`
						: upgradeResultLabel(result)}
				</Text>
			</HStack>
			{updating ? (
				<ProgressView
					value={percent / 100}
					modifiers={[
						tint(color),
						padding({ leading: 40 }),
						accessibilityLabel(`${result.environmentName} ${percent}% complete`)
					]}
				/>
			) : null}
		</VStack>
	);
}

function EnvironmentDetail({ result }: { result: EnvironmentUpdateResult }) {
	const color = useTintColor()(upgradeResultTint(result));
	const logs = resultLogs(result.logs);
	const from = result.fromVersion?.trim();
	const to = result.toVersion?.trim();
	return (
		<List
			modifiers={[
				listStyle('plain'),
				navigationTitle(result.environmentName || result.environmentId),
				navigationBarTitleDisplayMode('inline')
			]}
		>
			<Section>
				<LabeledContent label="Status">
					<Text modifiers={[foregroundStyle(color)]}>{upgradeResultLabel(result)}</Text>
				</LabeledContent>
				{result.status === 'updating' && result.percent !== undefined ? (
					<LabeledContent label="Progress">
						<Text modifiers={[monospacedDigit()]}>{`${Math.round(result.percent)}%`}</Text>
					</LabeledContent>
				) : null}
				{from ? (
					<LabeledContent label="Current Version">
						<Text modifiers={[textSelection(true)]}>{from}</Text>
					</LabeledContent>
				) : null}
				{to && to !== from ? (
					<LabeledContent label="Target Version">
						<Text modifiers={[textSelection(true)]}>{to}</Text>
					</LabeledContent>
				) : null}
				{upgradeResultIsManager(result) ? (
					<LabeledContent label="Role">
						<Text>Manager</Text>
					</LabeledContent>
				) : null}
			</Section>
			{result.status === 'failed' && result.error ? (
				<Section title="Error">
					<Text modifiers={[foregroundStyle(systemColors.red), textSelection(true)]}>
						{result.error}
					</Text>
				</Section>
			) : null}
			<Section title="Logs">
				{logs ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2', design: 'monospaced' }),
							textSelection(true),
							frame({ maxWidth: Infinity, alignment: 'leading' })
						]}
					>
						{logs}
					</Text>
				) : (
					<Text modifiers={[foregroundStyle(secondary)]}>No logs yet</Text>
				)}
			</Section>
		</List>
	);
}
