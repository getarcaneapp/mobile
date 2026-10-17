/**
 * Pure pieces of `DashboardStreamStore.swift` and `SystemStatsHistoryStore.swift`:
 * per-environment state transitions, the aggregate/attention folds, the
 * rolling stats window, and the reconnect backoff. Free of RN imports so
 * they're unit-testable.
 */
import { JSONValue } from '@/sdk/types/json';
import type { DashboardSnapshot, DashboardStreamErrorCode } from '@/sdk/models/dashboard';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { SystemStats } from '@/sdk/models/system/SystemStats';

// MARK: - Dashboard stream

/** Port of `DashboardStreamStore.EnvironmentState`. Replaced wholesale on every change. */
export type DashboardEnvironmentState = {
	id: string;
	name: string;
	snapshot?: DashboardSnapshot;
	/**
	 * One-way latch: flips on the first snapshot and never back, so later
	 * errors keep showing the last-known counts instead of skeletons.
	 */
	hasLoaded: boolean;
	loading: boolean;
	streamError: boolean;
	errorMessage?: string;
	errorCode?: DashboardStreamErrorCode;
};

export type DashboardStates = Readonly<Record<string, DashboardEnvironmentState>>;

/** Port of `DashboardStreamStore.AggregateCounts`. */
export type AggregateCounts = {
	runningContainers: number;
	stoppedContainers: number;
	totalContainers: number;
	totalImages: number;
	imageUpdates: number;
};

/** Port of `DashboardStreamStore.AttentionSummary`. */
export type AttentionSummary = {
	erroringEnvironmentIDs: ReadonlySet<string>;
	stoppedContainers: number;
	imageUpdates: number;
	expiringKeys: number;
	vulnerabilities: number;
	mostVulnerableEnvironmentID?: string;
	hasCriticalVulnerabilities: boolean;
	/**
	 * Environments whose snapshot reports a newer Arcane release; undefined
	 * until at least one snapshot has loaded (v1 servers never do).
	 */
	arcaneUpgradeCount?: number;
};

export const emptyAttention: AttentionSummary = {
	erroringEnvironmentIDs: new Set(),
	stoppedContainers: 0,
	imageUpdates: 0,
	expiringKeys: 0,
	vulnerabilities: 0,
	hasCriticalVulnerabilities: false
};

export function makeEnvironmentState(id: string, name: string): DashboardEnvironmentState {
	return { id, name, hasLoaded: false, loading: true, streamError: false };
}

/** Swift `environment.name?.trimmed`, falling back to the ID. */
export function streamDisplayName(environment: Pick<Environment, 'id' | 'name'>): string {
	const name = environment.name?.trim() ?? '';
	return name ? name : environment.id;
}

export function applySnapshot(
	states: DashboardStates,
	environmentID: string,
	snapshot: DashboardSnapshot
): DashboardStates {
	const state = states[environmentID];
	// Events can keep arriving briefly for environments removed by reconcile; don't resurrect them.
	if (!state) return states;
	return {
		...states,
		[environmentID]: {
			id: state.id,
			name: state.name,
			snapshot,
			hasLoaded: true,
			loading: false,
			streamError: false
		}
	};
}

export function applyError(
	states: DashboardStates,
	environmentID: string,
	message: string | undefined,
	code: DashboardStreamErrorCode | undefined
): DashboardStates {
	const state = states[environmentID];
	if (!state) return states;
	return {
		...states,
		[environmentID]: {
			id: state.id,
			name: state.name,
			hasLoaded: false,
			loading: false,
			streamError: true,
			errorMessage: message,
			errorCode: code
		}
	};
}

export function invalidateSnapshots(states: DashboardStates): DashboardStates {
	return Object.fromEntries(
		Object.entries(states).map(([id, state]) => [
			id,
			{ ...state, snapshot: undefined, hasLoaded: false, loading: true }
		])
	);
}

export function clearAllStreamErrors(states: DashboardStates): DashboardStates {
	if (!Object.values(states).some((state) => state.streamError)) return states;
	return Object.fromEntries(
		Object.entries(states).map(([id, state]) => [
			id,
			state.streamError
				? { ...state, streamError: false, errorMessage: undefined, errorCode: undefined }
				: state
		])
	);
}

/**
 * Tracks the enabled environments only — the aggregated stream never serves
 * disabled ones. Returns the next states and the IDs that were newly added.
 */
export function reconcileStates(
	states: DashboardStates,
	environments: readonly Pick<Environment, 'id' | 'name' | 'enabled'>[]
): { states: DashboardStates; added: string[] } {
	const enabled = environments.filter((e) => e.enabled);
	const next: Record<string, DashboardEnvironmentState> = {};
	const added: string[] = [];
	for (const environment of enabled) {
		const displayName = streamDisplayName(environment);
		const existing = states[environment.id];
		if (existing) {
			next[environment.id] =
				existing.name === displayName ? existing : { ...existing, name: displayName };
		} else {
			next[environment.id] = makeEnvironmentState(environment.id, displayName);
			added.push(environment.id);
		}
	}
	return { states: next, added };
}

/**
 * Aggregate tile counts across tracked environments. Every environment must
 * have a snapshot from the current stream connection; stale or partial data
 * is never presented as a live total.
 */
export function resolvedAggregate(states: DashboardStates): AggregateCounts | undefined {
	const values = Object.values(states);
	if (values.length === 0) return undefined;
	const counts: AggregateCounts = {
		runningContainers: 0,
		stoppedContainers: 0,
		totalContainers: 0,
		totalImages: 0,
		imageUpdates: 0
	};
	for (const state of values) {
		const snapshot = state.snapshot;
		if (!state.hasLoaded || !snapshot) return undefined;
		counts.runningContainers += snapshot.containers.counts.runningContainers;
		counts.stoppedContainers += snapshot.containers.counts.stoppedContainers;
		counts.totalContainers += snapshot.containers.counts.totalContainers;
		counts.totalImages += snapshot.imageUsageCounts.totalImages;
		counts.imageUpdates += snapshot.actionItems.items.reduce(
			(total, item) => (item.kind === 'image_updates' ? total + item.count : total),
			0
		);
	}
	return counts;
}

export function resolvedAttention(states: DashboardStates): AttentionSummary {
	const erroring = new Set<string>();
	const summary = { ...emptyAttention, erroringEnvironmentIDs: erroring } as {
		-readonly [K in keyof AttentionSummary]: AttentionSummary[K];
	};
	let upgradesLoaded = 0;
	let upgradesAvailable = 0;
	let mostVulnerableCount = 0;
	for (const id of Object.keys(states).sort()) {
		const state = states[id];
		if (!state) continue;
		if (state.streamError) erroring.add(id);
		const snapshot = state.snapshot;
		if (!state.hasLoaded || !snapshot) continue;
		if (snapshot.versionInfo) {
			upgradesLoaded += 1;
			if (snapshot.versionInfo.updateAvailable) upgradesAvailable += 1;
		}
		for (const item of snapshot.actionItems.items) {
			switch (item.kind) {
				case 'stopped_containers':
					summary.stoppedContainers += item.count;
					break;
				case 'image_updates':
					summary.imageUpdates += item.count;
					break;
				case 'expiring_keys':
					summary.expiringKeys += item.count;
					break;
				case 'actionable_vulnerabilities':
					summary.vulnerabilities += item.count;
					if (item.severity === 'critical') summary.hasCriticalVulnerabilities = true;
					if (item.count > mostVulnerableCount) {
						mostVulnerableCount = item.count;
						summary.mostVulnerableEnvironmentID = id;
					}
					break;
				default:
					break;
			}
		}
	}
	summary.arcaneUpgradeCount = upgradesLoaded > 0 ? upgradesAvailable : undefined;
	return summary;
}

export function sameAggregate(
	a: AggregateCounts | undefined,
	b: AggregateCounts | undefined
): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return (
		a.runningContainers === b.runningContainers &&
		a.stoppedContainers === b.stoppedContainers &&
		a.totalContainers === b.totalContainers &&
		a.totalImages === b.totalImages &&
		a.imageUpdates === b.imageUpdates
	);
}

export function sameAttention(a: AttentionSummary, b: AttentionSummary): boolean {
	return (
		a.stoppedContainers === b.stoppedContainers &&
		a.imageUpdates === b.imageUpdates &&
		a.expiringKeys === b.expiringKeys &&
		a.vulnerabilities === b.vulnerabilities &&
		a.mostVulnerableEnvironmentID === b.mostVulnerableEnvironmentID &&
		a.hasCriticalVulnerabilities === b.hasCriticalVulnerabilities &&
		a.arcaneUpgradeCount === b.arcaneUpgradeCount &&
		a.erroringEnvironmentIDs.size === b.erroringEnvironmentIDs.size &&
		[...a.erroringEnvironmentIDs].every((id) => b.erroringEnvironmentIDs.has(id))
	);
}

// MARK: - Reconnect backoff (shared by both stores)

export const StreamBackoff = {
	maxReconnectAttempts: 20,
	maxReconnectDelaySeconds: 15,
	/** A connection must survive this long before the attempt budget resets. */
	stableConnectionSeconds: 5,
	/** After the fast-backoff budget is spent, keep probing at this cadence forever. */
	idleRetrySeconds: 30
} as const;

/**
 * Next delay (seconds) and attempt counter. `exhausted` is true once the fast
 * budget is spent (the dashboard stream's `streamFailed`).
 */
export function nextReconnect(attempt: number): {
	delay: number;
	attempt: number;
	exhausted: boolean;
} {
	if (attempt >= StreamBackoff.maxReconnectAttempts) {
		return { delay: StreamBackoff.idleRetrySeconds, attempt, exhausted: true };
	}
	return {
		delay: Math.min(Math.pow(2, attempt), StreamBackoff.maxReconnectDelaySeconds),
		attempt: attempt + 1,
		exhausted: false
	};
}

// MARK: - System stats history

/** Port of Models.swift `SparklineSample`. */
export type SparklineSample = { timestamp: number; value: number };

/** Port of `SystemStatsHistoryStore.Series`. Replaced wholesale on every frame. */
export type StatsSeries = {
	cpu: SparklineSample[];
	memory: SparklineSample[];
	latest?: SystemStats;
	error?: string;
};

export const emptySeries: StatsSeries = { cpu: [], memory: [] };

/** Five minutes at the stream's 2s cadence. */
export const statsWindowSize = 150;

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

/** Appends one frame, keeping the newest `statsWindowSize` samples per series. */
export function appendFrame(series: StatsSeries, frame: SystemStats, now: number): StatsSeries {
	const cpu = [
		...series.cpu,
		{ timestamp: now, value: clampPercent(SystemStatsDisplay.cpuPercent(frame)) }
	];
	const memoryPercent = SystemStatsDisplay.memoryPercent(frame);
	const memory =
		memoryPercent === undefined
			? series.memory
			: [...series.memory, { timestamp: now, value: clampPercent(memoryPercent) }];
	return {
		latest: frame,
		error: undefined,
		cpu: cpu.length > statsWindowSize ? cpu.slice(cpu.length - statsWindowSize) : cpu,
		memory: memory.length > statsWindowSize ? memory.slice(memory.length - statsWindowSize) : memory
	};
}

/** Port of `LiveStatsLimit`: how many environments stream live host stats (App Settings). */
export const LiveStatsLimit = {
	preferenceKey: 'arcane.liveStatsEnvironmentLimit',
	/** Streams every enabled environment. */
	all: 0,
	defaultValue: 8,
	choices: [4, 8, 16, 0] as const,
	maxStreams(stored: number | undefined): number {
		const limit = stored ?? LiveStatsLimit.defaultValue;
		return limit === LiveStatsLimit.all ? Number.MAX_SAFE_INTEGER : limit;
	},
	title(value: number): string {
		return value === LiveStatsLimit.all ? 'All' : String(value);
	}
} as const;

// MARK: - Model presentation (Models.swift extensions)

/** `extension SystemStats` presentation helpers. */
export const SystemStatsDisplay = {
	cpuPercent: (stats: SystemStats) => stats.cpuUsage,
	memoryUsageBytes: (stats: SystemStats) => stats.memoryUsage,
	memoryTotalBytes: (stats: SystemStats) => stats.memoryTotal,
	diskUsageBytes: (stats: SystemStats) => stats.diskUsage,
	diskTotalBytes: (stats: SystemStats) => stats.diskTotal,
	memoryPercent: (stats: SystemStats): number | undefined =>
		stats.memoryTotal > 0 ? (stats.memoryUsage / stats.memoryTotal) * 100 : undefined,
	diskPercent: (stats: SystemStats | undefined): number | undefined => {
		const used = stats?.diskUsage;
		const total = stats?.diskTotal;
		return used !== undefined && total !== undefined && total > 0
			? (used / total) * 100
			: undefined;
	}
} as const;

/** `extension DockerInfo` count accessors. */
export const DockerCounts = {
	containers: (info: DockerInfo) => JSONValue.int64Value(info.info?.['Containers']) ?? 0,
	containersRunning: (info: DockerInfo) =>
		JSONValue.int64Value(info.info?.['ContainersRunning']) ?? 0,
	containersStopped: (info: DockerInfo) =>
		JSONValue.int64Value(info.info?.['ContainersStopped']) ?? 0,
	images: (info: DockerInfo) => JSONValue.int64Value(info.info?.['Images']) ?? 0,
	memTotal: (info: DockerInfo) => JSONValue.int64Value(info.info?.['MemTotal']),
	serverVersion: (info: DockerInfo) => JSONValue.stringValue(info.info?.['ServerVersion'])
} as const;

/** `Arcane.Environment.isOnline`. */
export function environmentIsOnline(environment: Pick<Environment, 'status'>): boolean {
	const lower = environment.status.toLowerCase();
	return lower === 'online' || lower === 'up';
}
