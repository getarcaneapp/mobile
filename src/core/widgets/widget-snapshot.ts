import type { ActionItems } from '@/sdk/models/dashboard';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import { DockerCounts, type DashboardStates } from '@/stores/dashboard-stream-logic';

export const widgetSnapshotSchemaVersion = 3;
export const maximumWidgetEnvironments = 10;
const maximumCount = 1_000_000_000;
const maximumTextLength = 128;

export type WidgetEnvironmentSummary = {
	id: string;
	name: string;
	online: boolean;
	running: number;
	stopped: number;
	total: number;
	images: number;
	updatesAvailable: number;
	actionableVulnerabilities?: number;
};

export type WidgetSnapshot = {
	schemaVersion: number;
	generatedAt: string;
	serverConfigured: boolean;
	serverOrigin?: string;
	isDemo: boolean;
	accentHex?: string;
	activeEnvironmentID?: string;
	environments: WidgetEnvironmentSummary[];
};

export type WidgetEnvironmentSources = {
	environments: readonly Pick<Environment, 'id' | 'name'>[];
	dashboardStates: DashboardStates;
	dockerInfo: Readonly<Record<string, DockerInfo>>;
	unavailableEnvironmentIDs: ReadonlySet<string>;
	actionItems: (environmentID: string) => ActionItems | undefined;
	previous: readonly WidgetEnvironmentSummary[];
};

const count = (value: number) =>
	Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 0), maximumCount) : 0;

const text = (value: string) => Array.from(value).slice(0, maximumTextLength).join('');

function actionCount(items: ActionItems | undefined, kind: string): number | undefined {
	if (!items) return undefined;
	return items.items.reduce((total, item) => (item.kind === kind ? total + item.count : total), 0);
}

export function widgetDate(date: Date): string {
	return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function buildWidgetEnvironments(
	sources: WidgetEnvironmentSources
): WidgetEnvironmentSummary[] | undefined {
	const previousByID = new Map(sources.previous.map((summary) => [summary.id, summary]));
	const summaries: WidgetEnvironmentSummary[] = [];
	for (const environment of sources.environments.slice(0, maximumWidgetEnvironments)) {
		const previous = previousByID.get(environment.id);
		const trimmedName = environment.name?.trim() ?? '';
		const name = text(trimmedName === '' ? environment.id : trimmedName);
		const state = sources.dashboardStates[environment.id];
		const snapshot = state?.hasLoaded ? state.snapshot : undefined;
		const info = sources.dockerInfo[environment.id];
		const unavailable = sources.unavailableEnvironmentIDs.has(environment.id);
		const items = snapshot?.actionItems ?? sources.actionItems(environment.id);
		const updatesAvailable = count(
			actionCount(items, 'image_updates') ?? previous?.updatesAvailable ?? 0
		);
		const vulnerabilities =
			actionCount(items, 'actionable_vulnerabilities') ?? previous?.actionableVulnerabilities;
		const actionableVulnerabilities =
			vulnerabilities === undefined ? undefined : count(vulnerabilities);
		const base = { id: text(environment.id), name, updatesAvailable, actionableVulnerabilities };

		if (snapshot && !state?.streamError) {
			const counts = snapshot.containers.counts;
			summaries.push({
				...base,
				online: true,
				running: count(counts.runningContainers),
				stopped: count(counts.stoppedContainers),
				total: count(counts.totalContainers),
				images: count(snapshot.imageUsageCounts.totalImages)
			});
		} else if (info && !unavailable) {
			summaries.push({
				...base,
				online: true,
				running: count(DockerCounts.containersRunning(info)),
				stopped: count(DockerCounts.containersStopped(info)),
				total: count(DockerCounts.containers(info)),
				images: count(DockerCounts.images(info))
			});
		} else if (unavailable || state?.streamError) {
			summaries.push({ ...base, online: false, running: 0, stopped: 0, total: 0, images: 0 });
		} else if (previous) {
			summaries.push({ ...previous, name });
		} else {
			return undefined;
		}
	}
	return summaries;
}

export function signedOutWidgetSnapshot(generatedAt: Date): WidgetSnapshot {
	return {
		schemaVersion: widgetSnapshotSchemaVersion,
		generatedAt: widgetDate(generatedAt),
		serverConfigured: false,
		isDemo: false,
		environments: []
	};
}

export function materialWidgetKey(snapshot: WidgetSnapshot): string {
	return JSON.stringify({ ...snapshot, generatedAt: '' });
}
