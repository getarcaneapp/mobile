import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	Label,
	LabeledContent,
	List,
	Section,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	monospacedDigit,
	refreshable,
	scrollEdgeEffectStyle,
	textSelection,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors, systemColors } from '@/theme/colors';
import { MonospacedValue } from '@/ui/components/resource-detail';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';

import { LinkRow } from '@/features/containers/container-sections';

import { SwarmStateBadge } from './swarm-parts';
import { EmbeddedServiceLogs } from './swarm-logs';
import { SwarmTasksList } from './swarm-tasks-view';
import { useSwarmServiceDetail, type SwarmServiceDetailModel } from './use-swarm-service-detail';

function Overview({ model }: { model: SwarmServiceDetailModel }) {
	const accent = useAccentColor();
	const { draft, inspect } = model;
	return (
		<List
			modifiers={[
				listStyle('insetGrouped'),
				scrollEdgeEffectStyle('soft', 'top'),
				refreshable(model.load)
			]}
		>
			<Section>
				<HStack spacing={14}>
					<Image
						systemName="shippingbox.fill"
						modifiers={[
							font({ textStyle: 'title' }),
							foregroundStyle(accent),
							frame({ width: 52, height: 52 }),
							accessibilityHidden(true)
						]}
					/>
					<VStack alignment="leading" spacing={4}>
						<Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{model.name}</Text>
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
								lineLimit(2),
								truncationMode('middle'),
								textSelection(true)
							]}
						>
							{model.image}
						</Text>
						{model.runningText ? (
							<Text
								modifiers={[
									font({ textStyle: 'caption', weight: 'semibold' }),
									monospacedDigit(),
									foregroundStyle(model.summaryHealthy ? systemColors.green : systemColors.orange)
								]}
							>
								{model.runningText}
							</Text>
						) : null}
					</VStack>
				</HStack>
			</Section>
			{model.errorMessage && !inspect ? (
				<Section>
					<Label
						title={model.errorMessage}
						systemImage="exclamationmark.triangle"
						modifiers={[foregroundStyle(systemColors.orange)]}
					/>
					<Button label="Retry" onPress={() => void model.load()} />
				</Section>
			) : null}
			<Section title="Details">
				<LabeledContent label="ID">
					<MonospacedValue value={model.serviceID.slice(0, 12)} />
				</LabeledContent>
				{model.modeTitle ? (
					<LabeledContent label="Mode">
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							{model.modeTitle}
						</Text>
					</LabeledContent>
				) : null}
				{model.stackName ? (
					<LabeledContent label="Stack">
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							{model.stackName}
						</Text>
					</LabeledContent>
				) : null}
				{model.nodeCount !== undefined ? (
					<LabeledContent label="Nodes">
						<Text>{String(model.nodeCount)}</Text>
					</LabeledContent>
				) : null}
				{model.versionIndex !== undefined ? (
					<LabeledContent label="Version">
						<Text modifiers={[monospacedDigit()]}>{String(model.versionIndex)}</Text>
					</LabeledContent>
				) : null}
				{model.createdText ? (
					<LabeledContent label="Created">
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							{model.createdText}
						</Text>
					</LabeledContent>
				) : null}
				{model.updatedText ? (
					<LabeledContent label="Updated">
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							{model.updatedText}
						</Text>
					</LabeledContent>
				) : null}
			</Section>
			{model.updateState ? (
				<Section title="Last Update">
					<LabeledContent label="State">
						<SwarmStateBadge state={model.updateState} />
					</LabeledContent>
					{model.updateMessage ? (
						<Text
							modifiers={[
								font({ textStyle: 'callout' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{model.updateMessage}
						</Text>
					) : null}
				</Section>
			) : null}
			{draft && model.hasConfigRows ? (
				<Section title="Configuration">
					{draft.command !== '' ? (
						<LabeledContent label="Command">
							<MonospacedValue value={draft.command} />
						</LabeledContent>
					) : null}
					{draft.args !== '' ? (
						<LabeledContent label="Args">
							<MonospacedValue value={draft.args} />
						</LabeledContent>
					) : null}
					{draft.workingDir !== '' ? (
						<LabeledContent label="Working Dir">
							<MonospacedValue value={draft.workingDir} />
						</LabeledContent>
					) : null}
					{draft.user !== '' ? (
						<LabeledContent label="User">
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								{draft.user}
							</Text>
						</LabeledContent>
					) : null}
					{draft.env.length > 0 ? (
						<LinkRow
							title={`Environment (${draft.env.length})`}
							systemImage="list.bullet.rectangle"
							onPress={model.openEnv}
						/>
					) : null}
					{draft.labels.length > 0 ? (
						<LinkRow
							title={`Labels (${draft.labels.length})`}
							systemImage="tag"
							onPress={model.openLabels}
						/>
					) : null}
				</Section>
			) : null}
			{draft && (draft.ports.length > 0 || model.virtualIPs.length > 0) ? (
				<Section title="Endpoints">
					{draft.ports.map((port) => (
						<LabeledContent
							key={port.id}
							label={
								<Text
									modifiers={[font({ textStyle: 'callout', design: 'monospaced' })]}
								>{`${port.target}/${port.proto}`}</Text>
							}
						>
							<Text modifiers={[font({ textStyle: 'callout', design: 'monospaced' })]}>
								{port.published === '' ? 'Not published' : port.published}
							</Text>
						</LabeledContent>
					))}
					{model.virtualIPs.map((address) => (
						<LabeledContent key={address} label="Virtual IP">
							<MonospacedValue value={address} />
						</LabeledContent>
					))}
				</Section>
			) : null}
			{model.networkDetails.length > 0 ? (
				<Section title="Networks">
					{model.networkDetails.map((network) => (
						<VStack key={network.id} alignment="leading" spacing={3}>
							<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
								{network.name}
							</Text>
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{model.networkDescription(network)}
							</Text>
							{(network.ipamConfigs ?? []).map((config, index) =>
								config.subnet ? (
									<Text
										key={index}
										modifiers={[
											font({ textStyle: 'caption', design: 'monospaced' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										{config.subnet}
									</Text>
								) : null
							)}
						</VStack>
					))}
				</Section>
			) : model.summaryNetworks.length > 0 ? (
				<Section title="Networks">
					{model.summaryNetworks.map((network) => (
						<Text key={network}>{network}</Text>
					))}
				</Section>
			) : null}
			{model.mounts.length > 0 ? (
				<Section title="Storage">
					{model.mounts.map((mount, index) => (
						<VStack key={index} alignment="leading" spacing={3} modifiers={[textSelection(true)]}>
							<Text modifiers={[font({ textStyle: 'callout', design: 'monospaced' })]}>
								{mount.target}
							</Text>
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{model.mountDescription(mount)}
							</Text>
						</VStack>
					))}
				</Section>
			) : null}
		</List>
	);
}

export function SwarmServiceDetailScreen() {
	const model = useSwarmServiceDetail();
	const { toolbar } = model;
	return (
		<>
			<Stack.Screen
				options={{
					title: model.name,
					headerLargeTitleEnabled: false,
					headerTransparent: false,
					headerShadowVisible: false,
					headerStyle: { backgroundColor: colors.systemGroupedBackground }
				}}
			/>
			<ResourceActionsToolbar
				primary={toolbar.primary}
				secondary={toolbar.secondary}
				overflow={toolbar.overflow}
				runningItemID={toolbar.runningItemID}
				isDisabled={toolbar.isDisabled}
				resourceName={model.name}
				active={model.canManage}
			/>
			<View style={{ flex: 1 }}>
				<ScrollableTabBar
					selection={model.selectedTab}
					onSelectionChange={model.setSelectedTab}
					options={model.tabs}
					accessibilityLabel="Service detail sections"
				/>
				<View style={{ flex: 1 }}>
					{model.selectedTab === 'overview' ? (
						<Host style={{ flex: 1 }}>
							<Overview model={model} />
						</Host>
					) : null}
					{model.selectedTab === 'tasks' ? (
						<Host style={{ flex: 1 }}>
							<SwarmTasksList
								environmentID={model.environmentID}
								source={{ kind: 'service', id: model.serviceID }}
							/>
						</Host>
					) : null}
					{model.selectedTab === 'logs' ? (
						<EmbeddedServiceLogs
							environmentID={model.environmentID}
							serviceID={model.serviceID}
							title={model.name}
						/>
					) : null}
				</View>
			</View>
		</>
	);
}
