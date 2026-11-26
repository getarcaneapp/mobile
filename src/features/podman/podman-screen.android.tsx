import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import type { EnvironmentID } from '@/sdk/client/environment';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { CenteredMessage, M3Section, ValueRow } from '@/features/containers/android-material';
import { LinkItem } from '@/features/networks/android-parts';

import { usePodmanHub } from './use-podman';

export function PodmanScreen({
	environmentID,
	environmentName
}: {
	environmentID: EnvironmentID;
	environmentName: string;
}) {
	const hub = usePodmanHub(environmentID);
	const [refreshing, setRefreshing] = useState(false);
	const { status } = hub;

	let content;
	if (status?.detected) {
		content = (
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void hub.load().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
						<Icon name="cube.transparent" size={28} color={m3.primary} />
						<View style={{ flex: 1, gap: 3 }}>
							<Text style={[m3Type.titleMedium, { color: colors.label }]}>{environmentName}</Text>
							<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
								{hub.podCountText}
							</Text>
						</View>
					</View>
					{hub.details.map((detail) => (
						<ValueRow key={detail.title} title={detail.title} value={detail.value} />
					))}
					{hub.systemdReason ? (
						<Text
							style={[
								m3Type.bodySmall,
								{ color: systemColors.orange, paddingHorizontal: 16, paddingBottom: 12 }
							]}
						>
							{hub.systemdReason}
						</Text>
					) : null}
				</M3Section>
				{hub.canPods || hub.canQuadlets || hub.canKube ? (
					<M3Section title="Workloads">
						{hub.canPods ? (
							<LinkItem title="Pods" icon="circle.hexagongrid.fill" onPress={hub.openPods} />
						) : null}
						{hub.canQuadlets ? (
							<LinkItem title="Quadlets" icon="doc.badge.gearshape" onPress={hub.openQuadlets} />
						) : null}
						{hub.canKube ? (
							<LinkItem title="Kube" icon="square.stack.3d.down.right" onPress={hub.openKube} />
						) : null}
					</M3Section>
				) : null}
				{hub.canSecrets || hub.canAutoUpdate ? (
					<M3Section title="Configuration">
						{hub.canSecrets ? (
							<LinkItem title="Secrets" icon="key.fill" onPress={hub.openSecrets} />
						) : null}
						{hub.canAutoUpdate ? (
							<LinkItem
								title="Auto-Update"
								icon="arrow.triangle.2.circlepath"
								onPress={hub.openAutoUpdate}
							/>
						) : null}
					</M3Section>
				) : null}
			</ScrollView>
		);
	} else if (status !== undefined) {
		content = (
			<CenteredMessage
				icon="cube.transparent"
				title="Podman Not Detected"
				message={status.reason ?? `${environmentName} doesn't run Podman.`}
				action={{ title: 'Check Again', onPress: () => void hub.load() }}
			/>
		);
	} else if (hub.errorMessage !== undefined) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Podman"
				message={hub.errorMessage}
				action={{ title: 'Try Again', onPress: () => void hub.load() }}
			/>
		);
	} else {
		content = (
			<View
				style={{
					flex: 1,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: colors.systemGroupedBackground
				}}
			>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Podman' }} />
			{content}
		</>
	);
}
