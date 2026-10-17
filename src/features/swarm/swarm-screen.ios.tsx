import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	Form,
	HStack,
	Label,
	List,
	ProgressView,
	Section,
	Spacer,
	Text,
	Toggle,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	listStyle,
	padding,
	refreshable,
	scrollEdgeEffectStyle,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { EnvironmentID } from '@/sdk/client/environment';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';

import { LinkRow } from '@/features/containers/container-sections';

import { shortID, swarmDate } from './swarm-common';
import { useSwarmNavigation } from './swarm-routes';
import { useSwarmHub, useSwarmSetup, type SwarmSetupModel } from './use-swarm';

function ActionButton({
	title,
	systemImage,
	running,
	onPress,
	isDisabled
}: {
	title: string;
	systemImage: string;
	running: boolean;
	onPress: () => void;
	isDisabled?: boolean;
}) {
	return (
		<Button onPress={onPress} modifiers={isDisabled ? [disabled(true)] : undefined}>
			<HStack>
				<Label title={title} systemImage={systemImage as SFSymbol} />
				{running ? (
					<>
						<Spacer />
						<ProgressView modifiers={[controlSize('small')]} />
					</>
				) : null}
			</HStack>
		</Button>
	);
}

function SwarmSetupForm({
	model,
	environmentName
}: {
	model: SwarmSetupModel;
	environmentName: string;
}) {
	return (
		<Form modifiers={[disabled(model.isBusy)]}>
			<Section>
				<VStack alignment="leading" spacing={6} modifiers={[padding({ vertical: 4 })]}>
					<Label
						title="Not in a Swarm"
						systemImage="square.stack.3d.up.slash"
						modifiers={[font({ textStyle: 'headline' })]}
					/>
					<Text
						modifiers={[
							font({ textStyle: 'callout' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{`${environmentName} isn't part of a Docker swarm. Initialize a new swarm or join an existing one.`}
					</Text>
				</VStack>
			</Section>
			{model.canInitialize ? (
				<Section
					header={<Text>Initialize</Text>}
					footer={<Text>This host becomes the first manager of a new swarm.</Text>}
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
					<Toggle
						label="Autolock Managers"
						isOn={model.autoLock}
						onIsOnChange={model.setAutoLock}
					/>
					<Toggle
						label="Force New Cluster"
						isOn={model.forceNewCluster}
						onIsOnChange={model.setForceNewCluster}
					/>
					<ActionButton
						title="Initialize Swarm"
						systemImage="plus.circle"
						running={model.runningAction === 'init'}
						onPress={model.initialize}
					/>
				</Section>
			) : null}
			{model.canJoin ? (
				<Section header={<Text>Join</Text>}>
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
					<ActionButton
						title="Join Swarm"
						systemImage="person.badge.plus"
						running={model.runningAction === 'join'}
						onPress={model.join}
						isDisabled={!model.canSubmitJoin}
					/>
				</Section>
			) : null}
			{model.errorMessage ? (
				<Section>
					<Label
						title={model.errorMessage}
						systemImage="exclamationmark.triangle.fill"
						modifiers={[foregroundStyle(systemColors.red), font({ textStyle: 'callout' })]}
					/>
				</Section>
			) : null}
		</Form>
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
	const accent = useAccentColor();
	const { info } = hub;

	let content;
	if (hub.isActive === true) {
		content = (
			<List
				modifiers={[
					listStyle('insetGrouped'),
					scrollEdgeEffectStyle('soft', 'top'),
					refreshable(hub.load)
				]}
			>
				{info ? (
					<Section>
						<HStack spacing={14}>
							<Image
								systemName="square.stack.3d.up.fill"
								modifiers={[
									font({ textStyle: 'title2' }),
									foregroundStyle(accent),
									frame({ width: 44, height: 44 }),
									accessibilityHidden(true)
								]}
							/>
							<VStack alignment="leading" spacing={3}>
								<Text modifiers={[font({ textStyle: 'headline' })]}>{environmentName}</Text>
								<Text
									modifiers={[
										font({ textStyle: 'caption', design: 'monospaced' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
										textSelection(true)
									]}
								>
									{shortID(info.id)}
								</Text>
								<Text
									modifiers={[
										font({ textStyle: 'caption' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>{`Created ${swarmDate(info.createdAt)}`}</Text>
							</VStack>
						</HStack>
						{info.rootRotationInProgress ? (
							<Label
								title="Root CA rotation in progress"
								systemImage="arrow.triangle.2.circlepath"
								modifiers={[font({ textStyle: 'callout' }), foregroundStyle(systemColors.orange)]}
							/>
						) : null}
					</Section>
				) : null}
				<Section title="Workloads">
					<LinkRow
						title="Services"
						systemImage="shippingbox.fill"
						onPress={() => swarm.openServices(environmentID)}
					/>
					<LinkRow
						title="Stacks"
						systemImage="square.stack.3d.up"
						onPress={() => swarm.openStacks(environmentID)}
					/>
					<LinkRow
						title="Tasks"
						systemImage="checklist"
						onPress={() => swarm.openTasks(environmentID, { kind: 'all' })}
					/>
				</Section>
				<Section title="Cluster">
					<LinkRow
						title="Nodes"
						systemImage="server.rack"
						onPress={() => swarm.openNodes(environmentID)}
					/>
					<LinkRow
						title="Configs"
						systemImage="doc.text"
						onPress={() => swarm.openKeyValues(environmentID, 'config')}
					/>
					<LinkRow
						title="Secrets"
						systemImage="key.fill"
						onPress={() => swarm.openKeyValues(environmentID, 'secret')}
					/>
					<LinkRow
						title="Cluster"
						systemImage="point.3.connected.trianglepath.dotted"
						onPress={() => swarm.openCluster(environmentID)}
					/>
				</Section>
			</List>
		);
	} else if (hub.isActive === false) {
		content = <SwarmSetupForm model={setup} environmentName={environmentName} />;
	} else if (hub.errorMessage !== undefined) {
		content = (
			<UnavailableView
				title="Couldn't Load Swarm"
				systemImage="exclamationmark.triangle"
				description={hub.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void hub.load() }]}
			/>
		);
	} else {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Swarm' }} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
