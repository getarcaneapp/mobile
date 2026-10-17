/** Port of Models/System/WebSocketMetrics.swift. */
import type { ISODateString } from '../base/date';

/** Stable identifiers for the different WebSocket connection kinds. */
export type WebSocketKind =
	| 'project_logs'
	| 'container_logs'
	| 'container_stats'
	| 'container_exec'
	| 'system_stats'
	| 'service_logs';

export const WebSocketKind = {
	projectLogs: 'project_logs',
	containerLogs: 'container_logs',
	containerStats: 'container_stats',
	containerExec: 'container_exec',
	systemStats: 'system_stats',
	serviceLogs: 'service_logs'
} as const satisfies Record<string, WebSocketKind>;

/** Description of a single active WebSocket connection on the server. */
export interface WebSocketConnectionInfo {
	id: string;
	kind: string;
	envId?: string;
	resourceId?: string;
	clientIp?: string;
	userId?: string;
	userAgent?: string;
	startedAt: ISODateString;
}

/** Point-in-time snapshot of active WebSocket connection counts by kind. */
export interface WebSocketMetricsSnapshot {
	projectLogsActive: number;
	containerLogsActive: number;
	containerStats: number;
	containerExec: number;
	systemStats: number;
	serviceLogsActive: number;
}
