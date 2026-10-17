import { parseArcaneDate } from '@/sdk/models/base/date';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { systemColors } from '@/theme/colors';
import type { ResourceMetadataItem } from '@/ui/components/resource-detail.types';

import type { EnvironmentDetails } from './environment-detail-model';

export type EnvironmentConnectionProps = {
	environment: Environment;
	details: EnvironmentDetails | undefined;
	managerURL: string;
	isAvailable?: boolean;
};

export const edgePacketDuration = 2.4;
export const directPacketDuration = 4.8;

function urlParts(value: string): { scheme?: string; host?: string } {
	const match = /^([A-Za-z][A-Za-z0-9+.-]*):(?:\/\/(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*))?/.exec(
		value.trim()
	);
	if (!match) return {};
	const host = match[2];
	return { scheme: match[1], host: host ? host.replace(/^\[|\]$/g, '') : undefined };
}

export function connectionPresentation({
	environment,
	details,
	managerURL,
	isAvailable = true
}: EnvironmentConnectionProps) {
	const live =
		isAvailable &&
		environment.enabled &&
		(environment.isEdge ? environment.connected === true : environment.status === 'online');

	const connectionStatus = (() => {
		if (!isAvailable) return 'Unavailable';
		if (!environment.enabled) return 'Disabled';
		if (live) return 'Connected';
		switch (environment.status) {
			case 'standby':
				return 'Standby';
			case 'pending':
				return 'Connecting';
			case 'error':
				return 'Error';
			default:
				return 'Disconnected';
		}
	})();

	const statusTint: string | undefined = live
		? systemColors.green
		: environment.status === 'standby'
			? systemColors.blue
			: environment.status === 'pending'
				? systemColors.orange
				: undefined;

	const managerName = urlParts(managerURL).host ?? 'Manager';
	const agentName = environment.name ?? environment.id;
	const apiScheme = urlParts(environment.apiUrl).scheme;

	const transport = (() => {
		if (!environment.isEdge) return apiScheme?.toUpperCase() ?? 'Direct';
		switch (environment.edgeTransport ?? environment.lastEdgeTransport) {
			case 'grpc':
				return 'gRPC';
			case 'websocket':
				return 'WebSocket';
			default:
				return 'Edge tunnel';
		}
	})();

	const dataPlane =
		details?.edgeDataPlane === 'mux'
			? 'Multiplexed'
			: details?.edgeDataPlane === 'legacy'
				? 'Legacy'
				: undefined;

	const security = (() => {
		if (environment.isEdge) {
			switch (environment.edgeSecurityMode) {
				case 'mtls':
					return 'mTLS';
				case 'token':
					return 'Token';
				default:
					return 'Unknown';
			}
		}
		return apiScheme === 'https' ? 'HTTPS' : 'HTTP';
	})();

	const securityIcon =
		environment.edgeSecurityMode === 'mtls'
			? 'checkmark.shield'
			: environment.isEdge || security === 'HTTPS'
				? 'lock'
				: 'network';

	const roundTrip = (() => {
		const value = details?.edgeRoundTripMs;
		if (value === undefined || !Number.isFinite(value) || value < 0) return '—';
		return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ms`;
	})();
	const openStreams =
		details?.edgeOpenStreams !== undefined ? String(details.edgeOpenStreams) : '—';
	const connectionMode = environment.lastPollAt === undefined ? 'Persistent' : 'Polling';

	const tunnelMetrics: ResourceMetadataItem[] = [
		{ label: 'Round Trip', value: roundTrip, systemImage: 'arrow.left.arrow.right' },
		{
			label: 'Open Streams',
			value: openStreams,
			systemImage: 'point.3.connected.trianglepath.dotted'
		},
		{ label: 'Connection Mode', value: connectionMode, systemImage: 'network' },
		{ label: 'Security', value: security, systemImage: securityIcon }
	];

	const capabilities = (() => {
		const list = environment.edgeCapabilities;
		if (!list || list.length === 0) return undefined;
		const features = list.filter((capability) => !capability.includes('.'));
		const commands = list.length - features.length;
		return [...features, `${commands} commands`].join(' · ');
	})();

	const transportCaption = [transport, dataPlane]
		.filter((part): part is string => part !== undefined)
		.join(' · ');

	return {
		live,
		connectionStatus,
		statusTint,
		managerName,
		agentName,
		transport,
		transportCaption,
		security,
		securityIcon,
		tunnelMetrics,
		capabilities,
		accessibilityLabel: `${managerName} to ${agentName}, ${transport}, ${security}, ${connectionStatus}`,
		lastSeen: parseDate(environment.lastSeen),
		connectedAt: parseDate(environment.connectedAt),
		lastPollAt: parseDate(environment.lastPollAt),
		lastHeartbeat: parseDate(environment.lastHeartbeat),
		certificate: environment.edgeMTLSCertificate
	};
}

export type ConnectionPresentation = ReturnType<typeof connectionPresentation>;

function parseDate(value: string | undefined): Date | undefined {
	return value ? parseArcaneDate(value) : undefined;
}

export const isHeartbeatStale = (heartbeat: Date, now: Date) =>
	(now.getTime() - heartbeat.getTime()) / 1000 > 90;

export function certificateStatus(certificate: { expired: boolean; expiringSoon: boolean }): {
	text: string;
	tint: string;
} {
	if (certificate.expired) return { text: 'Expired', tint: systemColors.red };
	if (certificate.expiringSoon) return { text: 'Expiring Soon', tint: systemColors.orange };
	return { text: 'Valid', tint: systemColors.green };
}

export const connectedSinceText = (date: Date) =>
	date.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

export const expiryText = (date: Date) =>
	date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function relativeText(date: Date, now: Date): string {
	let seconds = Math.max(0, Math.round(Math.abs(now.getTime() - date.getTime()) / 1000));
	const units: [number, string][] = [
		[86_400, 'day'],
		[3_600, 'hr'],
		[60, 'min'],
		[1, 'sec']
	];
	const parts: string[] = [];
	for (const [size, name] of units) {
		if (parts.length === 2) break;
		const count = Math.floor(seconds / size);
		if (count > 0 || (size === 1 && parts.length === 0)) {
			parts.push(`${count} ${name}${name === 'day' && count !== 1 ? 's' : ''}`);
			seconds -= count * size;
		} else if (parts.length > 0) {
			break;
		}
	}
	return parts.join(', ');
}

export function timerText(date: Date, now: Date): string {
	const total = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const pad = (value: number) => String(value).padStart(2, '0');
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export const isAccessibilityFontScale = (fontScale: number) => fontScale >= 1.6;
