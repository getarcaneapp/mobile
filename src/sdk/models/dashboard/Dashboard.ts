/** Port of Models/Dashboard/Dashboard.swift. */
import type { JSONValue } from '../../types/json';
import { D, DecodingError } from '../base/decoding';
import type { PaginationResponse } from '../base/pagination';
import { ContainerSummary, type ContainerStatusCounts } from '../container/ContainerSummary';
import type { ImageUsageCounts } from '../image/ImageSummary';
import type { VersionInfo } from '../version/VersionInfo';

/**
 * Kinds of dashboard action items. Unknown kinds from newer servers pass
 * through instead of failing the whole snapshot — the dashboard stream dies
 * wholesale on any undecodable line, so action items must never poison it.
 */
export type ActionItemKind =
	| 'stopped_containers'
	| 'image_updates'
	| 'actionable_vulnerabilities'
	| 'expiring_keys'
	| (string & {});

export const ActionItemKind = {
	stoppedContainers: 'stopped_containers',
	imageUpdates: 'image_updates',
	actionableVulnerabilities: 'actionable_vulnerabilities',
	expiringKeys: 'expiring_keys',
	knownCases: [
		'stopped_containers',
		'image_updates',
		'actionable_vulnerabilities',
		'expiring_keys'
	] as const,
	isKnown(this: void, value: ActionItemKind): boolean {
		return (ActionItemKind.knownCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): ActionItemKind {
		return raw;
	},
	rawValue(this: void, value: ActionItemKind): string {
		return value;
	},
	decode(this: void, raw: unknown): ActionItemKind {
		return D.str(raw);
	}
} as const;

/** Severity of a dashboard action item; unknown severities pass through. */
export type ActionItemSeverity = 'warning' | 'critical' | (string & {});

export const ActionItemSeverity = {
	warning: 'warning',
	critical: 'critical',
	knownCases: ['warning', 'critical'] as const,
	isKnown(this: void, value: ActionItemSeverity): boolean {
		return (ActionItemSeverity.knownCases as readonly string[]).includes(value);
	},
	unknown(this: void, raw: string): ActionItemSeverity {
		return raw;
	},
	rawValue(this: void, value: ActionItemSeverity): string {
		return value;
	},
	decode(this: void, raw: unknown): ActionItemSeverity {
		return D.str(raw);
	}
} as const;

/** A single attention item rendered on the dashboard. */
export interface ActionItem {
	kind: ActionItemKind;
	count: number;
	severity: ActionItemSeverity;
}

export const ActionItem = {
	decode(this: void, raw: unknown): ActionItem {
		const o = D.object(raw, 'ActionItem');
		return {
			kind: D.nested(o, 'kind', ActionItemKind.decode),
			count: D.int(o, 'count'),
			severity: D.nested(o, 'severity', ActionItemSeverity.decode)
		};
	}
} as const;

/** Collection of dashboard action items. */
export interface ActionItems {
	items: ActionItem[];
}

export const ActionItems = {
	/** Swift init default: `items: []`. */
	make(this: void, items: ActionItem[] = []): ActionItems {
		return { items };
	},
	decode(this: void, raw: unknown): ActionItems {
		const o = D.object(raw, 'ActionItems');
		return { items: D.array(o, 'items', ActionItem.decode) };
	}
} as const;

/**
 * Settings payload carried in dashboard snapshots. Currently empty
 * server-side; Swift models it as a field-less struct.
 */
export type DashboardSnapshotSettings = Record<string, never>;

export const DashboardSnapshotSettings = {
	make(this: void): DashboardSnapshotSettings {
		return {};
	},
	/** Swift decodes no fields: any payload becomes an empty value. */
	decode(this: void, _raw: unknown): DashboardSnapshotSettings {
		return {};
	}
} as const;

export type EnvironmentSnapshotState = 'ready' | 'skipped' | 'error';

export const EnvironmentSnapshotState = {
	ready: 'ready',
	skipped: 'skipped',
	error: 'error',
	/** Synthesized Swift decoding: unknown raw values fail. */
	decode(this: void, raw: unknown): EnvironmentSnapshotState {
		const value = D.str(raw);
		if (value === 'ready' || value === 'skipped' || value === 'error') return value;
		throw new DecodingError(`Unknown EnvironmentSnapshotState "${value}"`);
	}
} as const;

/**
 * Dashboard environment-overview row, one per visible environment. The full
 * `environment` blob is preserved as JSON.
 */
export interface DashboardEnvironmentOverview {
	environment: JSONValue;
	containers: ContainerStatusCounts;
	imageUsageCounts: ImageUsageCounts;
	actionItems: ActionItems;
	settings: DashboardSnapshotSettings;
	versionInfo?: VersionInfo;
	snapshotState: EnvironmentSnapshotState;
	snapshotError?: string;
}

export const DashboardEnvironmentOverview = {
	decode(this: void, raw: unknown): DashboardEnvironmentOverview {
		const o = D.object(raw, 'DashboardEnvironmentOverview');
		return {
			// JSON `null` is stripped by the transport, so a missing key is `null`.
			environment: (o['environment'] ?? null) as JSONValue,
			containers: D.nested(o, 'containers', D.cast<ContainerStatusCounts>),
			imageUsageCounts: D.nested(o, 'imageUsageCounts', D.cast<ImageUsageCounts>),
			actionItems: D.nested(o, 'actionItems', ActionItems.decode),
			settings: D.nested(o, 'settings', DashboardSnapshotSettings.decode),
			versionInfo: D.optNested(o, 'versionInfo', D.cast<VersionInfo>),
			snapshotState: D.nested(o, 'snapshotState', EnvironmentSnapshotState.decode),
			snapshotError: D.optString(o, 'snapshotError')
		};
	}
} as const;

export interface DashboardEnvironmentsSummary {
	totalEnvironments: number;
	onlineEnvironments: number;
	standbyEnvironments: number;
	offlineEnvironments: number;
	pendingEnvironments: number;
	errorEnvironments: number;
	disabledEnvironments: number;
	containers: ContainerStatusCounts;
	imageUsageCounts: ImageUsageCounts;
	environmentsWithActionItems: number;
}

export const DashboardEnvironmentsSummary = {
	/** Swift init defaults: zero counts. */
	make(args: Partial<DashboardEnvironmentsSummary> = {}): DashboardEnvironmentsSummary {
		return {
			totalEnvironments: args.totalEnvironments ?? 0,
			onlineEnvironments: args.onlineEnvironments ?? 0,
			standbyEnvironments: args.standbyEnvironments ?? 0,
			offlineEnvironments: args.offlineEnvironments ?? 0,
			pendingEnvironments: args.pendingEnvironments ?? 0,
			errorEnvironments: args.errorEnvironments ?? 0,
			disabledEnvironments: args.disabledEnvironments ?? 0,
			containers: args.containers ?? {
				runningContainers: 0,
				stoppedContainers: 0,
				totalContainers: 0
			},
			imageUsageCounts: args.imageUsageCounts ?? {
				imagesInuse: 0,
				imagesUnused: 0,
				totalImages: 0,
				totalImageSize: 0
			},
			environmentsWithActionItems: args.environmentsWithActionItems ?? 0
		};
	}
} as const;

export interface DashboardEnvironmentsOverview {
	summary: DashboardEnvironmentsSummary;
	environments: DashboardEnvironmentOverview[];
}

export const DashboardEnvironmentsOverview = {
	decode(this: void, raw: unknown): DashboardEnvironmentsOverview {
		const o = D.object(raw, 'DashboardEnvironmentsOverview');
		return {
			summary: D.nested(o, 'summary', D.cast<DashboardEnvironmentsSummary>),
			environments: D.array(o, 'environments', DashboardEnvironmentOverview.decode)
		};
	}
} as const;

/** Container table payload on the dashboard. */
export interface DashboardSnapshotContainers {
	data: ContainerSummary[];
	counts: ContainerStatusCounts;
	pagination: PaginationResponse;
}

export const DashboardSnapshotContainers = {
	/**
	 * Swift `init(from:)`. Stream events trim the table rows to JSON null
	 * (`"data": null`) — only the aggregate counts are meaningful there.
	 */
	decode(this: void, raw: unknown): DashboardSnapshotContainers {
		const o = D.object(raw, 'DashboardSnapshotContainers');
		return {
			data: D.optArray(o, 'data', ContainerSummary.decode) ?? [],
			counts: D.nested(o, 'counts', D.cast<ContainerStatusCounts>),
			pagination: D.nested(o, 'pagination', D.cast<PaginationResponse>)
		};
	}
} as const;

/** Image table payload on the dashboard. Images are kept as opaque JSON. */
export interface DashboardSnapshotImages {
	data: JSONValue[];
	pagination: PaginationResponse;
}

export const DashboardSnapshotImages = {
	/** Swift `init(from:)`. Stream events trim the table rows to JSON null. */
	decode(this: void, raw: unknown): DashboardSnapshotImages {
		const o = D.object(raw, 'DashboardSnapshotImages');
		return {
			data: D.optArray(o, 'data', (item) => (item ?? null) as JSONValue) ?? [],
			pagination: D.nested(o, 'pagination', D.cast<PaginationResponse>)
		};
	}
} as const;

/** Top-level dashboard first-paint snapshot. */
export interface DashboardSnapshot {
	containers: DashboardSnapshotContainers;
	images: DashboardSnapshotImages;
	imageUsageCounts: ImageUsageCounts;
	actionItems: ActionItems;
	settings: DashboardSnapshotSettings;
	/** Application version metadata for the environment, when available. */
	versionInfo?: VersionInfo;
}

export const DashboardSnapshot = {
	decode(this: void, raw: unknown): DashboardSnapshot {
		const o = D.object(raw, 'DashboardSnapshot');
		return {
			containers: D.nested(o, 'containers', DashboardSnapshotContainers.decode),
			images: D.nested(o, 'images', DashboardSnapshotImages.decode),
			imageUsageCounts: D.nested(o, 'imageUsageCounts', D.cast<ImageUsageCounts>),
			actionItems: D.nested(o, 'actionItems', ActionItems.decode),
			settings: D.nested(o, 'settings', DashboardSnapshotSettings.decode),
			versionInfo: D.optNested(o, 'versionInfo', D.cast<VersionInfo>)
		};
	}
} as const;
