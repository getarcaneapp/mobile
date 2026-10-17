/**
 * Android rendering of `EnvironmentConnectionView` (EnvironmentConnectionView.swift):
 * status, manager → agent path with animated packets, tunnel metrics, session
 * details, and the mTLS certificate.
 *
 * Standalone (RN views).
 */
import { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import { parseArcaneDate } from '@/sdk/models/base/date';
import type { EdgeMTLSCertificate } from '@/sdk/models/environment/EnvironmentModel';
import { colors, systemColors } from '@/theme/colors';
import { AdaptiveMetadataGrid, MonospacedValue } from '@/ui/components/resource-detail';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	certificateStatus,
	connectedSinceText,
	connectionPresentation,
	expiryText,
	isAccessibilityFontScale,
	isHeartbeatStale,
	relativeText,
	timerText,
	type ConnectionPresentation,
	type EnvironmentConnectionProps
} from './environment-connection-logic';
import { EnvironmentPacketTrack } from './environment-connection-packet-track';

function useNow(seconds: number) {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), seconds * 1000);
		return () => clearInterval(timer);
	}, [seconds]);
	return now;
}

// Read per render: colors follow the current appearance.
const caption = () => [m3Type.bodySmall, { color: colors.secondaryLabel }];

function Divider() {
	return <View style={{ height: 1, backgroundColor: colors.separator }} />;
}

function SessionValue({ label, value }: { label: string; value: string }) {
	return (
		<View style={{ gap: 4 }}>
			<Text style={caption()}>{label}</Text>
			<MonospacedValue value={value} />
		</View>
	);
}

function LabeledRow({
	label,
	value,
	valueColor,
	icon
}: {
	label: string;
	value: string;
	valueColor?: string;
	icon?: string;
}) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			{icon ? <Icon name={icon} size={18} color={colors.label} /> : null}
			<Text style={[m3Type.bodyMedium, { color: colors.label, flex: 1 }]}>{label}</Text>
			<Text
				selectable
				style={[
					m3Type.bodyMedium,
					{ color: valueColor ?? colors.secondaryLabel, fontVariant: ['tabular-nums'] }
				]}
			>
				{value}
			</Text>
		</View>
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
	// `Text(date, style: .timer)` ticks every second.
	const now = useNow(isEdge && p.live && p.connectedAt ? 1 : 30);
	const stale = p.lastHeartbeat ? isHeartbeatStale(p.lastHeartbeat, now) : false;
	return (
		<View style={{ gap: 8 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<View
					style={{
						width: 8,
						height: 8,
						borderRadius: 4,
						backgroundColor: p.statusTint ?? colors.secondaryLabel
					}}
				/>
				<Text style={[m3Type.titleMedium, { color: colors.label }]}>{p.connectionStatus}</Text>
				{p.live && isEdge && p.lastHeartbeat ? (
					<Text
						style={[m3Type.bodySmall, { color: stale ? systemColors.orange : systemColors.green }]}
					>
						{stale ? 'Stale Heartbeat' : 'Healthy'}
					</Text>
				) : null}
			</View>
			{isEdge ? (
				<View
					style={{
						flexDirection: isAccessibilitySize ? 'column' : 'row',
						flexWrap: 'wrap',
						columnGap: 12,
						rowGap: 4
					}}
				>
					{p.live && p.connectedAt ? (
						<Text style={caption()}>
							Connected for{' '}
							<Text style={{ fontVariant: ['tabular-nums'] }}>{timerText(p.connectedAt, now)}</Text>
						</Text>
					) : null}
					{p.lastHeartbeat ? (
						<Text style={caption()}>{`Last heartbeat ${relativeText(p.lastHeartbeat, now)}`}</Text>
					) : null}
				</View>
			) : null}
		</View>
	);
}

function ConnectionSymbol({ symbol }: { symbol: string }) {
	return (
		<View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
			<Icon name={symbol} size={22} color={colors.secondaryLabel} />
		</View>
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
	return (
		<View accessible accessibilityLabel={p.accessibilityLabel} style={{ gap: 8 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
				<ConnectionSymbol symbol="server.rack" />
				<EnvironmentPacketTrack live={p.live} isEdge={isEdge} leg={0} />
				<ConnectionSymbol symbol={p.securityIcon} />
				<EnvironmentPacketTrack live={p.live} isEdge={isEdge} leg={1} />
				<ConnectionSymbol symbol="externaldrive.connected.to.line.below" />
			</View>
			<View
				style={{
					flexDirection: isAccessibilitySize ? 'column' : 'row',
					alignItems: 'flex-start',
					gap: 8
				}}
			>
				<Text style={[caption(), { flex: isAccessibilitySize ? undefined : 1 }]}>
					{p.managerName}
				</Text>
				<Text
					style={[
						caption(),
						{
							flex: isAccessibilitySize ? undefined : 1,
							textAlign: isAccessibilitySize ? 'left' : 'center'
						}
					]}
				>
					{p.transportCaption}
				</Text>
				<Text
					style={[
						caption(),
						{
							flex: isAccessibilitySize ? undefined : 1,
							textAlign: isAccessibilitySize ? 'left' : 'right'
						}
					]}
				>
					{p.agentName}
				</Text>
			</View>
		</View>
	);
}

function SessionDetails({
	p,
	environment
}: {
	p: ConnectionPresentation;
	environment: EnvironmentConnectionProps['environment'];
}) {
	const now = useNow(30);
	return (
		<View style={{ gap: 12, paddingTop: 12 }}>
			{p.connectedAt ? (
				<LabeledRow label="Connected Since" value={connectedSinceText(p.connectedAt)} />
			) : null}
			{p.lastPollAt ? (
				<LabeledRow label="Last Poll" value={relativeText(p.lastPollAt, now)} />
			) : null}
			{environment.edgeSessionId ? (
				<SessionValue label="Session ID" value={environment.edgeSessionId} />
			) : null}
			{environment.edgeAgentInstance ? (
				<SessionValue label="Agent Instance" value={environment.edgeAgentInstance} />
			) : null}
			{p.capabilities ? <SessionValue label="Capabilities" value={p.capabilities} /> : null}
		</View>
	);
}

function CertificateDetails({ certificate }: { certificate: EdgeMTLSCertificate }) {
	const status = certificateStatus(certificate);
	const expiry = parseArcaneDate(certificate.expiresAt);
	return (
		<View style={{ gap: 16 }}>
			<Text style={[m3Type.titleMedium, { color: colors.label }]}>Security</Text>
			<LabeledRow
				label="mTLS Certificate"
				icon="checkmark.shield"
				value={status.text}
				valueColor={status.tint}
			/>
			{certificate.commonName ? (
				<SessionValue label="Common Name" value={certificate.commonName} />
			) : null}
			{expiry ? <LabeledRow label="Expires" value={expiryText(expiry)} /> : null}
			{certificate.daysRemaining !== undefined ? (
				<LabeledRow label="Days Remaining" value={String(certificate.daysRemaining)} />
			) : null}
		</View>
	);
}

export function EnvironmentConnectionView(props: EnvironmentConnectionProps) {
	const { environment } = props;
	const p = connectionPresentation(props);
	const { fontScale } = useWindowDimensions();
	const isAccessibilitySize = isAccessibilityFontScale(fontScale);
	const [showsSession, setShowsSession] = useState(false);
	const now = useNow(30);

	return (
		<View style={{ gap: 24, paddingVertical: 12 }}>
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
								<View style={{ gap: 20 }}>
									{p.tunnelMetrics.map((item) => (
										<View key={item.label} style={{ gap: 6 }}>
											<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
												<Icon name={item.systemImage} size={14} color={colors.secondaryLabel} />
												<Text style={caption()}>{item.label}</Text>
											</View>
											<Text style={[m3Type.titleSmall, { color: colors.label }]}>{item.value}</Text>
										</View>
									))}
								</View>
							) : (
								<AdaptiveMetadataGrid items={p.tunnelMetrics} />
							)}
							<View>
								<Pressable
									onPress={() => setShowsSession((value) => !value)}
									accessibilityRole="button"
									accessibilityState={{ expanded: showsSession }}
									android_ripple={{ color: colors.separator as string }}
									style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40 }}
								>
									<Text style={[m3Type.bodyMedium, { color: colors.label, flex: 1 }]}>
										Session Details
									</Text>
									<Icon
										name={showsSession ? 'chevron.up' : 'chevron.down'}
										size={20}
										color={colors.secondaryLabel}
									/>
								</Pressable>
								{showsSession ? <SessionDetails p={p} environment={environment} /> : null}
							</View>
							<Divider />
						</>
					) : null}
					{p.certificate ? <CertificateDetails certificate={p.certificate} /> : null}
				</>
			) : (
				<View style={{ gap: 16 }}>
					<SessionValue label="API URL" value={environment.apiUrl} />
					{p.lastSeen ? (
						<LabeledRow label="Last Seen" value={relativeText(p.lastSeen, now)} />
					) : null}
				</View>
			)}
		</View>
	);
}
