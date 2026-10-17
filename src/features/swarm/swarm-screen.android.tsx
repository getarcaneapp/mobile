import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { EnvironmentID } from '@/sdk/client/environment';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { CenteredMessage, M3Section, SwitchRow } from '@/features/containers/android-material';
import { ActionItem, LinkItem, SheetError } from '@/features/networks/android-parts';

import { shortID, swarmDate } from './swarm-common';
import { useSwarmNavigation } from './swarm-routes';
import { useSwarmHub, useSwarmSetup, type SwarmSetupModel } from './use-swarm';

function SwarmSetupForm({
	model,
	environmentName
}: {
	model: SwarmSetupModel;
	environmentName: string;
}) {
	const spinner = <ActivityIndicator size="small" />;
	return (
		<ScrollView
			style={{ backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingBottom: 32 }}
			keyboardShouldPersistTaps="handled"
		>
			<View
				pointerEvents={model.isBusy ? 'none' : 'auto'}
				style={{ opacity: model.isBusy ? 0.6 : 1 }}
			>
				<M3Section>
					<View style={{ padding: 16, gap: 6 }}>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
							<Icon name="square.stack.3d.up.slash" size={20} color={m3.primary} />
							<Text style={[m3Type.titleMedium, { color: colors.label }]}>Not in a Swarm</Text>
						</View>
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
							{`${environmentName} isn't part of a Docker swarm. Initialize a new swarm or join an existing one.`}
						</Text>
					</View>
				</M3Section>
				{model.canInitialize ? (
					<M3Section
						title="Initialize"
						footer="This host becomes the first manager of a new swarm."
					>
						<FormTextField
							title="Listen Address"
							placeholder="0.0.0.0:2377"
							text={model.listenAddress}
							onChangeText={model.setListenAddress}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormTextField
							title="Advertise Address"
							placeholder="Automatic"
							text={model.advertiseAddress}
							onChangeText={model.setAdvertiseAddress}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<SwitchRow
							title="Autolock Managers"
							value={model.autoLock}
							onValueChange={model.setAutoLock}
						/>
						<SwitchRow
							title="Force New Cluster"
							value={model.forceNewCluster}
							onValueChange={model.setForceNewCluster}
						/>
						<ActionItem
							title="Initialize Swarm"
							icon="plus.circle"
							onPress={model.initialize}
							trailing={model.runningAction === 'init' ? spinner : undefined}
						/>
					</M3Section>
				) : null}
				{model.canJoin ? (
					<M3Section title="Join">
						<FormTextField
							title="Manager Addresses"
							placeholder="10.0.0.1:2377"
							text={model.joinAddresses}
							onChangeText={model.setJoinAddresses}
							autocapitalization="never"
							autocorrectionDisabled
							helper="Comma-separated."
						/>
						<FormSecureField
							title="Join Token"
							placeholder="SWMTKN-…"
							text={model.joinToken}
							onChangeText={model.setJoinToken}
						/>
						<FormTextField
							title="Listen Address"
							placeholder="0.0.0.0:2377"
							text={model.joinListenAddress}
							onChangeText={model.setJoinListenAddress}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormTextField
							title="Advertise Address"
							placeholder="Automatic"
							text={model.joinAdvertiseAddress}
							onChangeText={model.setJoinAdvertiseAddress}
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<ActionItem
							title="Join Swarm"
							icon="person.badge.plus"
							onPress={model.join}
							disabled={!model.canSubmitJoin}
							trailing={model.runningAction === 'join' ? spinner : undefined}
						/>
					</M3Section>
				) : null}
				<SheetError message={model.errorMessage} />
			</View>
		</ScrollView>
	);
}

export function SwarmScreen({
	environmentID,
	environmentName
}: {
	environmentID: EnvironmentID;
	environmentName: string;
}) {
	const hub = useSwarmHub(environmentID);
	const setup = useSwarmSetup(environmentID);
	const swarm = useSwarmNavigation();
	const [refreshing, setRefreshing] = useState(false);
	const { info } = hub;

	let content;
	if (hub.isActive === true) {
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
				{info ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
							<Icon name="square.stack.3d.up.fill" size={28} color={m3.primary} />
							<View style={{ flex: 1, gap: 3 }}>
								<Text style={[m3Type.titleMedium, { color: colors.label }]}>{environmentName}</Text>
								<Text
									selectable
									style={{ fontFamily: monoFamily, fontSize: 12, color: colors.secondaryLabel }}
								>
									{shortID(info.id)}
								</Text>
								<Text
									style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
								>{`Created ${swarmDate(info.createdAt)}`}</Text>
							</View>
						</View>
						{info.rootRotationInProgress ? (
							<View
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 8,
									paddingHorizontal: 16,
									paddingBottom: 16
								}}
							>
								<Icon name="arrow.triangle.2.circlepath" size={18} color={systemColors.orange} />
								<Text style={[m3Type.bodyMedium, { color: systemColors.orange }]}>
									Root CA rotation in progress
								</Text>
							</View>
						) : null}
					</M3Section>
				) : null}
				<M3Section title="Workloads">
					<LinkItem
						title="Services"
						icon="shippingbox.fill"
						onPress={() => swarm.openServices(environmentID)}
					/>
					<LinkItem
						title="Stacks"
						icon="square.stack.3d.up"
						onPress={() => swarm.openStacks(environmentID)}
					/>
					<LinkItem
						title="Tasks"
						icon="checklist"
						onPress={() => swarm.openTasks(environmentID, { kind: 'all' })}
					/>
				</M3Section>
				<M3Section title="Cluster">
					<LinkItem
						title="Nodes"
						icon="server.rack"
						onPress={() => swarm.openNodes(environmentID)}
					/>
					<LinkItem
						title="Configs"
						icon="doc.text"
						onPress={() => swarm.openKeyValues(environmentID, 'config')}
					/>
					<LinkItem
						title="Secrets"
						icon="key.fill"
						onPress={() => swarm.openKeyValues(environmentID, 'secret')}
					/>
					<LinkItem
						title="Cluster"
						icon="point.3.connected.trianglepath.dotted"
						onPress={() => swarm.openCluster(environmentID)}
					/>
				</M3Section>
			</ScrollView>
		);
	} else if (hub.isActive === false) {
		content = <SwarmSetupForm model={setup} environmentName={environmentName} />;
	} else if (hub.errorMessage !== undefined) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Swarm"
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
			<Stack.Screen options={{ title: 'Swarm' }} />
			{content}
		</>
	);
}
