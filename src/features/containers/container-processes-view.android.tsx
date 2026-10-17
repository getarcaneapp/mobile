import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import type { EnvironmentID } from '@/sdk/client/environment';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import { CenteredMessage } from './android-material';
import { useContainerProcesses } from './use-container-processes';

export function ContainerProcessesView({
	environmentID,
	containerID
}: {
	environmentID: EnvironmentID;
	containerID: string;
}) {
	const { list, rows, isLoading, errorMessage, notRunning, load } = useContainerProcesses(
		environmentID,
		containerID
	);
	const [refreshing, setRefreshing] = useState(false);

	if (isLoading && !list) {
		return (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	}
	if (notRunning)
		return (
			<CenteredMessage
				icon="stop.circle"
				title="Container Not Running"
				message="Start the container to see its processes."
			/>
		);
	if (errorMessage !== undefined && !list) {
		return (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Processes"
				message={errorMessage}
				action={{ title: 'Try Again', onPress: () => void load() }}
			/>
		);
	}
	if (rows.length === 0)
		return (
			<CenteredMessage
				icon="list.number"
				title="No Processes"
				message="The container didn't report any processes."
			/>
		);

	return (
		<ScrollView
			style={{ backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingBottom: 24 }}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => {
						setRefreshing(true);
						void load().finally(() => setRefreshing(false));
					}}
				/>
			}
		>
			<MaterialSectionHeader title={`${rows.length} process${rows.length === 1 ? '' : 'es'}`} />
			<MaterialListGroup>
				{rows.map((row) => (
					<View key={row.id} style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
							{row.pid !== undefined ? (
								<Text
									selectable
									style={[
										m3Type.labelMedium,
										{
											color: systemColors.orange,
											backgroundColor: withOpacity(systemColors.orange, 0.15),
											borderRadius: Radius.small,
											paddingHorizontal: 6,
											paddingVertical: 2,
											fontVariant: ['tabular-nums']
										}
									]}
								>
									{row.pid}
								</Text>
							) : null}
							{row.user !== undefined ? (
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{row.user}</Text>
							) : null}
						</View>
						{row.command !== undefined ? (
							<Text
								numberOfLines={3}
								ellipsizeMode="middle"
								style={{ fontFamily: monoFamily, fontSize: 14, color: colors.label }}
							>
								{row.command}
							</Text>
						) : null}
						{row.extras.length > 0 ? (
							<Text
								numberOfLines={2}
								style={{ fontFamily: monoFamily, fontSize: 11, color: colors.secondaryLabel }}
							>
								{row.extras.map((extra) => `${extra.title} ${extra.value}`).join(' · ')}
							</Text>
						) : null}
					</View>
				))}
			</MaterialListGroup>
		</ScrollView>
	);
}
