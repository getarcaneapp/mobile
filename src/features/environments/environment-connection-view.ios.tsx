/**
 * Port of `EnvironmentConnectionView` + its private `EnvironmentConnectionStatus`
 * and `EnvironmentPacketTrack` (EnvironmentConnectionView.swift).
 *
 * SwiftUI-tree (rendered inside the detail page's List row).
 */
import {
	DisclosureGroup,
	Divider,
	HStack,
	Label,
	LabeledContent,
	RNHostView,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	monospacedDigit,
	multilineTextAlignment,
	padding
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { parseArcaneDate } from '@/sdk/models/base/date';
import type { EdgeMTLSCertificate } from '@/sdk/models/environment/EnvironmentModel';
import { systemColors } from '@/theme/colors';
import { AdaptiveMetadataGrid, MonospacedValue } from '@/ui/components/resource-detail';

import {
	certificateStatus,
	connectedSinceText,
	connectionPresentation,
	expiryText,
	isAccessibilityFontScale,
	isHeartbeatStale,
	type ConnectionPresentation,
	type EnvironmentConnectionProps
} from './environment-connection-logic';
import { EnvironmentPacketTrack } from './environment-connection-packet-track';
import { symbolRenderingMode } from '../../../modules/arcane-swiftui-extras';

/** `TimelineView(.periodic(from: .now, by: seconds))`. */
function useNow(seconds: number) {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), seconds * 1000);
		return () => clearInterval(timer);
	}, [seconds]);
	return now;
}

function SessionValue({ label, value }: { label: string; value: string }) {
	return (
		<VStack
			alignment="leading"
			spacing={4}
			modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
		>
			<Text
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{label}
			</Text>
			<MonospacedValue value={value} />
		</VStack>
	);
}

function ConnectionStatus({
	p,
	isEdge,
	isAccessibilitySize
}: {
	p: ConnectionPresentation;
	isEdge: boolean;
	isAccessibilitySize: boolean;
}) {
	const now = useNow(30);
	const timestamps = (
		<>
			{p.live && p.connectedAt ? (
				<HStack spacing={4} modifiers={[fixedSize({ horizontal: false, vertical: true })]}>
					<Text>Connected for</Text>
					<Text date={p.connectedAt} dateStyle="timer" modifiers={[monospacedDigit()]} />
				</HStack>
			) : null}
			{p.lastHeartbeat ? (
				<HStack spacing={4} modifiers={[fixedSize({ horizontal: false, vertical: true })]}>
					<Text>Last heartbeat</Text>
					<Text date={p.lastHeartbeat} dateStyle="relative" />
				</HStack>
			) : null}
		</>
	);
	const timestampModifiers = [
		font({ textStyle: 'caption' }),
		foregroundStyle({ type: 'hierarchical', style: 'secondary' })
	];
	return (
		<VStack
			alignment="leading"
			spacing={8}
			modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
		>
			<HStack spacing={8}>
				<Image
					systemName="circle.fill"
					modifiers={[
						font({ size: 8 }),
						foregroundStyle(p.statusTint ?? 'secondary'),
						accessibilityHidden(true)
					]}
				/>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{p.connectionStatus}</Text>
				{p.live && isEdge && p.lastHeartbeat ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle(
								isHeartbeatStale(p.lastHeartbeat, now) ? systemColors.orange : systemColors.green
							)
						]}
					>
						{isHeartbeatStale(p.lastHeartbeat, now) ? 'Stale Heartbeat' : 'Healthy'}
					</Text>
				) : null}
			</HStack>
			{isEdge ? (
				isAccessibilitySize ? (
					<VStack alignment="leading" spacing={4} modifiers={timestampModifiers}>
						{timestamps}
					</VStack>
				) : (
					<HStack
						spacing={12}
						modifiers={[...timestampModifiers, fixedSize({ horizontal: true, vertical: false })]}
					>
						{timestamps}
					</HStack>
				)
			) : null}
		</VStack>
	);
}

function ConnectionSymbol({ symbol }: { symbol: string }) {
	return (
		<Image
			systemName={symbol as SFSymbol}
			modifiers={[
				font({ textStyle: 'body' }),
				symbolRenderingMode('hierarchical'),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				frame({ width: 40, height: 40 })
			]}
		/>
	);
}

function PacketTrack({ live, isEdge, leg }: { live: boolean; isEdge: boolean; leg: 0 | 1 }) {
	return (
		<HStack
			modifiers={[
				frame({ maxWidth: Infinity, minHeight: 10, maxHeight: 10 }),
				accessibilityHidden(true)
			]}
		>
			<RNHostView>
				<EnvironmentPacketTrack live={live} isEdge={isEdge} leg={leg} />
			</RNHostView>
		</HStack>
	);
}

function ConnectionPath({
	p,
	isEdge,
	isAccessibilitySize
}: {
	p: ConnectionPresentation;
	isEdge: boolean;
	isAccessibilitySize: boolean;
}) {
	const captionModifiers = [
		font({ textStyle: 'caption' }),
		foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
		fixedSize({ horizontal: false, vertical: true })
	];
	const manager = (
		<Text
			modifiers={[
				multilineTextAlignment('leading'),
				frame({ maxWidth: Infinity, alignment: 'leading' })
			]}
		>
			{p.managerName}
		</Text>
	);
	const transport = (
		<Text
			modifiers={[
				multilineTextAlignment(isAccessibilitySize ? 'leading' : 'center'),
				frame({ maxWidth: Infinity, alignment: isAccessibilitySize ? 'leading' : 'center' })
			]}
		>
			{p.transportCaption}
		</Text>
	);
	const agent = (
		<Text
			modifiers={[
				multilineTextAlignment(isAccessibilitySize ? 'leading' : 'trailing'),
				frame({ maxWidth: Infinity, alignment: isAccessibilitySize ? 'leading' : 'trailing' })
			]}
		>
			{p.agentName}
		</Text>
	);
	return (
		<VStack
			spacing={8}
			modifiers={[accessibilityElement('ignore'), accessibilityLabel(p.accessibilityLabel)]}
		>
			<HStack spacing={12}>
				<ConnectionSymbol symbol="server.rack" />
				<PacketTrack live={p.live} isEdge={isEdge} leg={0} />
				<ConnectionSymbol symbol={p.securityIcon} />
				<PacketTrack live={p.live} isEdge={isEdge} leg={1} />
				<ConnectionSymbol symbol="externaldrive.connected.to.line.below" />
			</HStack>
			{isAccessibilitySize ? (
				<VStack alignment="leading" spacing={8} modifiers={captionModifiers}>
					{manager}
					{transport}
					{agent}
				</VStack>
			) : (
				<HStack alignment="top" spacing={8} modifiers={captionModifiers}>
					{manager}
					{transport}
					{agent}
				</HStack>
			)}
		</VStack>
	);
}

function SessionDetails({
	p,
	environment
}: {
	p: ConnectionPresentation;
	environment: EnvironmentConnectionProps['environment'];
}) {
	return (
		<VStack alignment="leading" spacing={12} modifiers={[padding({ top: 12 })]}>
			{p.connectedAt ? (
				<LabeledContent label="Connected Since">
					<Text>{connectedSinceText(p.connectedAt)}</Text>
				</LabeledContent>
			) : null}
			{p.lastPollAt ? (
				<LabeledContent label="Last Poll">
					<Text date={p.lastPollAt} dateStyle="relative" />
				</LabeledContent>
			) : null}
			{environment.edgeSessionId ? (
				<SessionValue label="Session ID" value={environment.edgeSessionId} />
			) : null}
			{environment.edgeAgentInstance ? (
				<SessionValue label="Agent Instance" value={environment.edgeAgentInstance} />
			) : null}
			{p.capabilities ? <SessionValue label="Capabilities" value={p.capabilities} /> : null}
		</VStack>
	);
}

function CertificateDetails({ certificate }: { certificate: EdgeMTLSCertificate }) {
	const status = certificateStatus(certificate);
	const expiry = parseArcaneDate(certificate.expiresAt);
	return (
		<VStack alignment="leading" spacing={16}>
			<Text modifiers={[font({ textStyle: 'headline' })]}>Security</Text>
			<LabeledContent
				label={<Label title="mTLS Certificate" systemImage="checkmark.shield" />}
				modifiers={[font({ textStyle: 'subheadline' })]}
			>
				<Text modifiers={[foregroundStyle(status.tint)]}>{status.text}</Text>
			</LabeledContent>
			{certificate.commonName ? (
				<SessionValue label="Common Name" value={certificate.commonName} />
			) : null}
			{expiry ? (
				<LabeledContent label="Expires" modifiers={[font({ textStyle: 'subheadline' })]}>
					<Text>{expiryText(expiry)}</Text>
				</LabeledContent>
			) : null}
			{certificate.daysRemaining !== undefined ? (
				<LabeledContent label="Days Remaining" modifiers={[font({ textStyle: 'subheadline' })]}>
					<Text>{String(certificate.daysRemaining)}</Text>
				</LabeledContent>
			) : null}
		</VStack>
	);
}

export function EnvironmentConnectionView(props: EnvironmentConnectionProps) {
	const { environment } = props;
	const p = connectionPresentation(props);
	const { fontScale } = useWindowDimensions();
	const isAccessibilitySize = isAccessibilityFontScale(fontScale);
	const [showsSession, setShowsSession] = useState(false);

	return (
		<VStack alignment="leading" spacing={24} modifiers={[padding({ vertical: 12 })]}>
			<ConnectionStatus
				p={p}
				isEdge={environment.isEdge}
				isAccessibilitySize={isAccessibilitySize}
			/>
			<ConnectionPath p={p} isEdge={environment.isEdge} isAccessibilitySize={isAccessibilitySize} />
			<Divider />
			{environment.isEdge ? (
				<>
					{p.live ? (
						<>
							{isAccessibilitySize ? (
								<VStack alignment="leading" spacing={20}>
									{p.tunnelMetrics.map((item) => (
										<VStack key={item.label} alignment="leading" spacing={6}>
											<Label
												title={item.label}
												systemImage={item.systemImage as SFSymbol}
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											/>
											<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
												{item.value}
											</Text>
										</VStack>
									))}
								</VStack>
							) : (
								<AdaptiveMetadataGrid items={p.tunnelMetrics} />
							)}
							<DisclosureGroup
								label="Session Details"
								isExpanded={showsSession}
								onIsExpandedChange={setShowsSession}
								modifiers={[font({ textStyle: 'subheadline' })]}
							>
								<SessionDetails p={p} environment={environment} />
							</DisclosureGroup>
							<Divider />
						</>
					) : null}
					{p.certificate ? <CertificateDetails certificate={p.certificate} /> : null}
				</>
			) : (
				<VStack alignment="leading" spacing={16}>
					<SessionValue label="API URL" value={environment.apiUrl} />
					{p.lastSeen ? (
						<LabeledContent label="Last Seen" modifiers={[font({ textStyle: 'subheadline' })]}>
							<Text date={p.lastSeen} dateStyle="relative" />
						</LabeledContent>
					) : null}
				</VStack>
			)}
		</VStack>
	);
}
