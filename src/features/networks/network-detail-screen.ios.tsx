import { Host } from '@/ui/host';
import {
	Button,
	ContextMenu,
	HStack,
	Label,
	LabeledContent,
	List,
	ProgressView,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	controlSize,
	font,
	foregroundStyle,
	lineLimit,
	listStyle,
	multilineTextAlignment,
	padding,
	refreshable,
	scrollEdgeEffectStyle,
	textSelection,
	tint,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import type { ReactNode } from 'react';

import { NetworkInspect } from '@/sdk/models/network/Network';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { secondaryHex, useIsDark } from '@/ui/components/accessibility';
import { DestructiveLabel } from '@/ui/components/labels';
import { MonospacedValue } from '@/ui/components/resource-detail';
import { RowIcon } from '@/ui/components/row-icon';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { LinkRow } from '@/features/containers/container-sections';

import {
	containerRowDisplayIP,
	containerRowDisplayName,
	ipamRows,
	networkMetadata,
	sortedPairs,
	titled,
	type NetworkContainerRowData
} from './network-model';
import { useNetworkDetail, type NetworkDetailModel } from './use-network-detail';

function InfoSection({
	title,
	count,
	children
}: {
	title: string;
	count?: number;
	children: ReactNode;
}) {
	return <Section header={<Text>{titled(title, count)}</Text>}>{children}</Section>;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
	return <LabeledContent label={label}>{children}</LabeledContent>;
}

function RowText({ value }: { value: string }) {
	return (
		<Text
			modifiers={[
				font({ textStyle: 'subheadline' }),
				multilineTextAlignment('trailing'),
				textSelection(true)
			]}
		>
			{value}
		</Text>
	);
}

function ContainerRow({ row }: { row: NetworkContainerRowData }) {
	const isDark = useIsDark();
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<RowIcon
				systemImage="shippingbox.fill"
				tint={withOpacity(secondaryHex[isDark ? 'dark' : 'light'], 0.6)}
				size={30}
			/>
			<VStack alignment="leading" spacing={4}>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'semibold' }),
						lineLimit(1),
						truncationMode('middle')
					]}
				>
					{containerRowDisplayName(row)}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption', design: 'monospaced' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						textSelection(true)
					]}
				>
					{containerRowDisplayIP(row)}
				</Text>
			</VStack>
			<Spacer minLength={0} />
		</HStack>
	);
}

function Disconnectable({
	model,
	row
}: {
	model: NetworkDetailModel;
	row: NetworkContainerRowData;
}) {
	if (!model.canDisconnect) return <ContainerRow row={row} />;
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Trigger>
					<ContainerRow row={row} />
				</ContextMenu.Trigger>
				<ContextMenu.Items>
					<Button
						role="destructive"
						onPress={() => model.requestDisconnect(row)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Disconnect" systemImage="link" />
					</Button>
				</ContextMenu.Items>
			</ContextMenu>
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Disconnect"
					systemImage="link"
					onPress={() => model.requestDisconnect(row)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

function DetailToolbar({ model }: { model: NetworkDetailModel }) {
	const accent = useAccentColor();
	const icon = useToolbarIcons(['link.badge.plus', 'trash']);
	if (!model.canConnect && model.isBuiltIn) return null;
	return (
		<AppToolbar placement="right" tintColor={accent}>
			{model.canConnect ? (
				<Stack.Toolbar.Button
					icon={icon('link.badge.plus')}
					accessibilityLabel="Connect Container"
					onPress={model.openConnect}
				/>
			) : null}
			{!model.isBuiltIn ? (
				<Stack.Toolbar.Button
					icon={icon('trash')}
					tintColor={systemColors.red}
					accessibilityLabel="Delete"
					onPress={model.requestDelete}
				/>
			) : null}
		</AppToolbar>
	);
}

export function NetworkDetailScreen() {
	const model = useNetworkDetail();
	const { network, inspect } = model;
	const ipam = ipamRows(inspect?.ipam);
	const peers = inspect ? NetworkInspect.peerList(inspect) : [];
	const services = inspect ? NetworkInspect.serviceList(inspect) : [];
	const labels = inspect ? sortedPairs(inspect.labels) : [];
	const options = inspect ? sortedPairs(inspect.options) : [];

	return (
		<>
			<Stack.Screen options={{ title: model.title, headerLargeTitleEnabled: false }} />
			<DetailToolbar model={model} />
			<Host style={{ flex: 1 }}>
				<List
					modifiers={[
						listStyle('insetGrouped'),
						scrollEdgeEffectStyle('soft', 'top'),
						refreshable(model.loadInspect)
					]}
				>
					<Section>
						<Label
							icon={<Image systemName="network" modifiers={[foregroundStyle(systemColors.teal)]} />}
						>
							<VStack alignment="leading">
								<Text modifiers={[font({ textStyle: 'headline' })]}>{network.name}</Text>
								<Text
									modifiers={[
										font({ textStyle: 'subheadline' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>
									{network.driver}
								</Text>
							</VStack>
						</Label>
					</Section>
					<InfoSection title="Details">
						{networkMetadata(network).map((item) => (
							<LabeledContent key={item.label} label={item.label}>
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{item.value}
								</Text>
							</LabeledContent>
						))}
						<InfoRow label="ID">
							<MonospacedValue value={network.id} />
						</InfoRow>
						{inspect ? (
							<>
								{inspect.internal ? (
									<InfoRow label="Internal">
										<RowText value="Yes" />
									</InfoRow>
								) : null}
								<InfoRow label="Attachable">
									<RowText value={inspect.attachable ? 'Yes' : 'No'} />
								</InfoRow>
								<InfoRow label="IPv4">
									<RowText value={inspect.enableIPv4 ? 'Enabled' : 'Disabled'} />
								</InfoRow>
								<InfoRow label="IPv6">
									<RowText value={inspect.enableIPv6 ? 'Enabled' : 'Disabled'} />
								</InfoRow>
							</>
						) : null}
						<LinkRow
							title="Topology"
							systemImage="point.topleft.down.curvedto.point.bottomright.up"
							onPress={model.openTopology}
						/>
					</InfoSection>
					{peers.length > 0 ? (
						<InfoSection title="Peers" count={peers.length}>
							{peers.map((peer) => (
								<InfoRow key={peer.name} label={peer.name}>
									<MonospacedValue value={peer.address} />
								</InfoRow>
							))}
						</InfoSection>
					) : null}
					{services.length > 0 ? (
						<InfoSection title="Services" count={services.length}>
							{services.map((service) => (
								<VStack key={service.name} alignment="leading" spacing={5}>
									<MonospacedValue value={service.name} />
									{service.vip ? (
										<LabeledContent label="VIP" modifiers={[font({ textStyle: 'subheadline' })]}>
											<MonospacedValue value={service.vip} />
										</LabeledContent>
									) : null}
									{service.ports.length > 0 ? (
										<LabeledContent label="Ports" modifiers={[font({ textStyle: 'subheadline' })]}>
											<MonospacedValue value={service.ports.join(', ')} />
										</LabeledContent>
									) : null}
								</VStack>
							))}
						</InfoSection>
					) : null}
					{ipam ? (
						<InfoSection title="IPAM">
							{ipam.map((row) => (
								<InfoRow key={row.id} label={row.label}>
									<MonospacedValue value={row.value} />
								</InfoRow>
							))}
						</InfoSection>
					) : null}
					{model.connectedRows.length > 0 ? (
						<InfoSection title="Connected Containers" count={model.connectedRows.length}>
							{model.connectedRows.map((row) => (
								<Disconnectable key={row.id} model={model} row={row} />
							))}
						</InfoSection>
					) : null}
					{labels.length > 0 ? (
						<InfoSection title="Labels">
							{labels.map((pair) => (
								<InfoRow key={pair.key} label={pair.key}>
									<RowText value={pair.value} />
								</InfoRow>
							))}
						</InfoSection>
					) : null}
					{options.length > 0 ? (
						<InfoSection title="Options">
							{options.map((pair) => (
								<InfoRow key={pair.key} label={pair.key}>
									<RowText value={pair.value} />
								</InfoRow>
							))}
						</InfoSection>
					) : null}
					{model.isLoadingInspect && !inspect ? (
						<HStack spacing={10} modifiers={[padding({ vertical: 8 })]}>
							<ProgressView modifiers={[controlSize('small')]} />
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								Loading network details…
							</Text>
						</HStack>
					) : null}
					{model.inspectError && !inspect ? (
						<Section>
							<Label
								title={model.inspectError}
								systemImage="exclamationmark.triangle"
								modifiers={[foregroundStyle(systemColors.orange)]}
							/>
							<Button label="Retry" onPress={() => void model.loadInspect()} />
						</Section>
					) : null}
				</List>
			</Host>
		</>
	);
}
