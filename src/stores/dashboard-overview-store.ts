import { create } from 'zustand';

import { deepEqual } from '@/core/deep-equal';
import { environmentSources } from '@/core/networking/environment-sources';
import type {
	EnvironmentDiskUsage,
	EnvironmentEvent,
	EnvironmentFinding,
	EnvironmentJob
} from '@/features/dashboard/dashboard-overview-logic';
import { flattenJobs } from '@/features/dashboard/dashboard-overview-logic';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { Activity } from '@/sdk/models/activity/Activity';
import type { VulnerabilityRiskOverview } from '@/sdk/types/VulnerabilityRiskOverview';

export type OverviewSectionStatus = 'idle' | 'loading' | 'ready' | 'failed';

type Section<T> = { status: OverviewSectionStatus; value: T };

export type DashboardOverviewState = {
	diskUsage: Section<EnvironmentDiskUsage[]>;
	jobs: Section<EnvironmentJob[]>;
	risk: Section<VulnerabilityRiskOverview | undefined>;
	findings: EnvironmentFinding[];
	events: Section<EnvironmentEvent[]>;
	activities: Section<Activity[]>;
	loadedAt: number;
	load: (input: {
		client: ArcaneClient;
		environmentIDs: readonly string[];
		supportsV3: boolean;
		supportsActivities: boolean;
	}) => Promise<void>;
};

const recentActivityLimit = 40;
const containerEventLimit = 20;

const empty = <T>(value: T): Section<T> => ({ status: 'idle', value });

async function collect<T>(
	environmentIDs: readonly string[],
	run: (environmentID: string) => Promise<T>
): Promise<{ values: { environmentID: string; value: T }[]; failed: boolean }> {
	const outcomes = await Promise.all(
		environmentIDs.map(async (environmentID) => {
			try {
				return { environmentID, value: await run(environmentID), ok: true as const };
			} catch {
				return { environmentID, ok: false as const };
			}
		})
	);
	const values = outcomes.flatMap((outcome) =>
		outcome.ok ? [{ environmentID: outcome.environmentID, value: outcome.value }] : []
	);
	return { values, failed: environmentIDs.length > 0 && values.length === 0 };
}

async function loadDiskUsage(client: ArcaneClient, environmentIDs: readonly string[]) {
	const { values, failed } = await collect(environmentIDs, (envID) =>
		client.system.diskUsage({ envID })
	);
	return {
		status: failed ? 'failed' : 'ready',
		value: values.map(({ environmentID, value }) => ({ environmentID, usage: value }))
	} satisfies Section<EnvironmentDiskUsage[]>;
}

async function loadJobs(client: ArcaneClient, environmentIDs: readonly string[]) {
	const { values, failed } = await collect(environmentIDs, (envID) => client.jobs.list({ envID }));
	return {
		status: failed ? 'failed' : 'ready',
		value: values.flatMap(({ environmentID, value }) => flattenJobs(environmentID, value.jobs))
	} satisfies Section<EnvironmentJob[]>;
}

async function loadEvents(client: ArcaneClient, environmentIDs: readonly string[]) {
	const { values, failed } = await collect(environmentIDs, (environmentID) =>
		client.events.listByEnvironmentPaginated({
			environmentID,
			limit: containerEventLimit,
			sort: 'timestamp',
			order: 'desc',
			type: 'container.oom,container.die'
		})
	);
	return {
		status: failed ? 'failed' : 'ready',
		value: values.flatMap(({ environmentID, value }) =>
			value.data.map((event) => ({ environmentID, event }))
		)
	} satisfies Section<EnvironmentEvent[]>;
}

async function loadRisk(client: ArcaneClient, environmentIDs: readonly string[]) {
	const [source] = await environmentSources(
		client,
		environmentIDs.map((id) => ({ id }))
	);
	if (!source) return { section: empty(undefined), findings: [] };
	try {
		const overview = await client.vulnerabilities.riskOverview({ envID: source.key });
		const single = source.environments.length === 1 ? source.key : undefined;
		const findings = (overview.riskiestFindings ?? []).flatMap((finding) => {
			const environmentID = single ?? finding.environmentId;
			return environmentID ? [{ environmentID, finding }] : [];
		});
		return { section: { status: 'ready', value: overview } as const, findings };
	} catch {
		return { section: { status: 'failed', value: undefined } as const, findings: [] };
	}
}

async function loadActivities(client: ArcaneClient, environmentIDs: readonly string[]) {
	const sources = await environmentSources(
		client,
		environmentIDs.map((id) => ({ id }))
	);
	const { values, failed } = await collect(
		sources.map((source) => source.key),
		(envID) => client.activities.listPaginated({ envID, order: 'desc', limit: recentActivityLimit })
	);
	const activities = values
		.flatMap(({ environmentID, value }) =>
			value.data.map((activity) =>
				activity.sourceEnvironmentID?.trim() || environmentID.includes(',')
					? activity
					: { ...activity, sourceEnvironmentID: environmentID }
			)
		)
		.sort(
			(a, b) =>
				(Date.parse(b.endedAt || b.startedAt) || 0) - (Date.parse(a.endedAt || a.startedAt) || 0)
		)
		.slice(0, recentActivityLimit);
	return { status: failed ? 'failed' : 'ready', value: activities } satisfies Section<Activity[]>;
}

let generation = 0;
let loadedClient: ArcaneClient | undefined;

const initial = {
	diskUsage: empty<EnvironmentDiskUsage[]>([]),
	jobs: empty<EnvironmentJob[]>([]),
	risk: empty<VulnerabilityRiskOverview | undefined>(undefined),
	findings: [] as EnvironmentFinding[],
	events: empty<EnvironmentEvent[]>([]),
	activities: empty<Activity[]>([]),
	loadedAt: 0
};

const loading = <T>(section: Section<T>): Section<T> =>
	section.status === 'ready' ? section : { ...section, status: 'loading' };

export const useDashboardOverviewStore = create<DashboardOverviewState>((set, get) => ({
	...initial,

	load: async ({ client, environmentIDs, supportsV3, supportsActivities }) => {
		const current = ++generation;
		if (client !== loadedClient) {
			loadedClient = client;
			set(initial);
		}
		const previous = get();
		set({
			diskUsage: supportsV3 ? loading(previous.diskUsage) : empty([]),
			jobs: loading(previous.jobs),
			risk: supportsV3 ? loading(previous.risk) : empty(undefined),
			events: loading(previous.events),
			activities: supportsActivities ? loading(previous.activities) : empty([]),
			loadedAt: Date.now()
		});
		const apply = (patch: Partial<DashboardOverviewState>) => {
			if (current !== generation) return;
			const state = get();
			const changed = Object.fromEntries(
				Object.entries(patch).filter(
					([key, value]) => !deepEqual(state[key as keyof DashboardOverviewState], value)
				)
			);
			if (Object.keys(changed).length > 0) set(changed);
		};
		await Promise.all([
			supportsV3
				? loadDiskUsage(client, environmentIDs).then((diskUsage) => apply({ diskUsage }))
				: undefined,
			loadJobs(client, environmentIDs).then((jobs) => apply({ jobs })),
			loadEvents(client, environmentIDs).then((events) => apply({ events })),
			supportsV3
				? loadRisk(client, environmentIDs).then(({ section, findings }) =>
						apply({ risk: section, findings })
					)
				: undefined,
			supportsActivities
				? loadActivities(client, environmentIDs).then((activities) => apply({ activities }))
				: undefined
		]);
	}
}));
