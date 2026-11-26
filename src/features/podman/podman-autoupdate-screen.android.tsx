import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { m3Type } from '@/ui/components/type-scale';

import { M3Section, SwitchRow, ValueRow } from '@/features/containers/android-material';
import { ActionItem, SectionTitle, SheetError } from '@/features/networks/android-parts';

import { autoUpdateUpdatedLabel, autoUpdateUpdatedStatus } from './podman-logic';
import { PodmanStateBadge } from './podman-state-badge';
import { usePodmanAutoUpdate, type PodmanAutoUpdateModel } from './use-podman-autoupdate';

const rowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	minHeight: 52,
	paddingHorizontal: 16,
	paddingVertical: 10
};
const listContentStyle = { paddingBottom: 32 };

function AutoUpdateHeader({ model }: { model: PodmanAutoUpdateModel }) {
	return (
		<View>
			<M3Section>
				<ValueRow title="Runs Through" value={model.modeTitle} />
				{model.supportsOptions ? (
					<>
						<SwitchRow title="Dry Run" value={model.dryRun} onValueChange={model.setDryRun} />
						<SwitchRow
							title="Roll Back on Failure"
							value={model.rollback}
							onValueChange={model.setRollback}
						/>
					</>
				) : null}
				<ActionItem
					title={model.runTitle}
					icon="arrow.triangle.2.circlepath"
					onPress={model.run}
					disabled={!model.canRun || model.isRunning}
					trailing={model.isRunning ? <ActivityIndicator size="small" /> : undefined}
				/>
			</M3Section>
			{model.unit ? (
				<M3Section title="systemd Unit">
					<View style={rowStyle}>
						<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>
							{model.unit.name || 'Unit'}
						</Text>
						<PodmanStateBadge state={model.unit.activeState} />
					</View>
				</M3Section>
			) : null}
			{model.reports.length > 0 ? <SectionTitle title="Containers" /> : null}
			{model.reports.length === 0 && model.result?.mode === 'rest' ? (
				<M3Section>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, padding: 16 }]}>
						No containers use an auto-update policy.
					</Text>
				</M3Section>
			) : null}
		</View>
	);
}

export function PodmanAutoUpdateScreen() {
	const model = usePodmanAutoUpdate();
	const errors = [...(model.errorMessage ? [model.errorMessage] : []), ...model.errors];
	return (
		<>
			<Stack.Screen options={{ title: 'Auto-Update' }} />
			<GroupedFlashList
				data={model.reports.map((report, index, all) => ({
					key: report.id,
					type: 'report',
					report,
					grouped: groupPosition(index, all.length)
				}))}
				renderEntry={({ report }) => (
					<View style={rowStyle}>
						<View style={{ flex: 1, gap: 3 }}>
							<Text numberOfLines={1} style={[m3Type.bodyLarge, { color: colors.label }]}>
								{report.containerName || report.containerId}
							</Text>
							<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
								{report.imageName}
							</Text>
						</View>
						<ResourceStatusBadge
							key={report.id}
							status={autoUpdateUpdatedStatus(report.updated)}
							isLive={false}
							label={autoUpdateUpdatedLabel(report.updated)}
						/>
					</View>
				)}
				header={<AutoUpdateHeader model={model} />}
				footer={
					errors.length > 0 ? (
						<View>
							{errors.map((message, index) => (
								<SheetError key={`${index}:${message}`} message={message} />
							))}
						</View>
					) : null
				}
				contentContainerStyle={listContentStyle}
			/>
		</>
	);
}
