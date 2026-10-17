import type { ISODateString } from '../base/date';

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

export interface WebSocketMetricsSnapshot {
	projectLogsActive: number;
	containerLogsActive: number;
	containerStats: number;
	containerExec: number;
	systemStats: number;
	serviceLogsActive: number;
}
