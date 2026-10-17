/**
 * Navigation for the Swarm destinations. Every route lives once in the shared
 * tab group (`swarm-*`), so pushes stay in whichever tab stack is current.
 * Objects for a pushed screen's first render go through `screenCache`.
 */
import { useMemo } from 'react';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { SwarmNode } from '@/sdk/models/swarm/SwarmNode';
import type { SwarmServiceInspect, SwarmServiceSummary } from '@/sdk/models/swarm/SwarmServices';

import { screenCache, useTabRouter } from '@/features/networks/tab-routes';

export type SwarmKeyValueKind = 'config' | 'secret';

/** `SwarmKeyValueListView.Item`. */
export type SwarmKeyValueItem = {
	id: string;
	spec: import('@/sdk/types/json').JSONValue;
	createdAt: string;
	updatedAt: string;
};

/** `SwarmTasksView.Source`. */
export type SwarmTaskSource =
	| { kind: 'all' }
	| { kind: 'service'; id: string }
	| { kind: 'stack'; name: string }
	| { kind: 'node'; id: string };

export const swarmKeys = {
	service: (env: EnvironmentID, id: string) => `swarm-service:${env}/${id}`,
	inspect: (env: EnvironmentID, id: string) => `swarm-inspect:${env}/${id}`,
	node: (env: EnvironmentID, id: string) => `swarm-node:${env}/${id}`,
	kvItem: (env: EnvironmentID, kind: SwarmKeyValueKind, id: string) =>
		`swarm-kv:${env}/${kind}/${id}`,
	/** Env / labels of a service draft for `EnvVarsView` / `LabelsView`. */
	serviceVars: (env: EnvironmentID, id: string) => `swarm-service-vars:${env}/${id}`,
	serviceLabels: (env: EnvironmentID, id: string) => `swarm-service-labels:${env}/${id}`
};

const seg = encodeURIComponent;

export function useSwarmNavigation() {
	const nav = useTabRouter();
	return useMemo(
		() => ({
			nav,
			openServices: (envID: EnvironmentID) => nav.push('swarm-services', { envID }),
			openService: (envID: EnvironmentID, summary: SwarmServiceSummary) => {
				screenCache.set(swarmKeys.service(envID, summary.id), summary);
				nav.push(`swarm-service/${seg(summary.id)}`, { envID });
			},
			openServiceLogs: (envID: EnvironmentID, service: { id: string; name: string }) =>
				nav.push(`swarm-service/${seg(service.id)}/logs`, { envID, title: service.name }),
			openServiceVars: (envID: EnvironmentID, serviceID: string, vars: string[]) => {
				screenCache.set(swarmKeys.serviceVars(envID, serviceID), vars);
				nav.push(`swarm-service/${seg(serviceID)}/env`, { envID });
			},
			openServiceLabels: (
				envID: EnvironmentID,
				serviceID: string,
				labels: Record<string, string>
			) => {
				screenCache.set(swarmKeys.serviceLabels(envID, serviceID), labels);
				nav.push(`swarm-service/${seg(serviceID)}/labels`, { envID });
			},
			openServiceEditor: (envID: EnvironmentID, existing?: SwarmServiceInspect) => {
				if (existing) screenCache.set(swarmKeys.inspect(envID, existing.id), existing);
				nav.push('swarm-service-editor', { envID, serviceID: existing?.id });
			},
			openScale: (envID: EnvironmentID, service: SwarmServiceSummary) => {
				screenCache.set(swarmKeys.service(envID, service.id), service);
				nav.push('swarm-service-scale', { envID, serviceID: service.id });
			},
			openStacks: (envID: EnvironmentID) => nav.push('swarm-stacks', { envID }),
			openStack: (envID: EnvironmentID, name: string) =>
				nav.push(`swarm-stack/${seg(name)}`, { envID }),
			openStackEditor: (envID: EnvironmentID, stackName?: string) =>
				nav.push('swarm-stack-editor', { envID, stack: stackName }),
			openTasks: (envID: EnvironmentID, source: SwarmTaskSource, title?: string) =>
				nav.push('swarm-tasks', {
					envID,
					source: source.kind,
					value:
						source.kind === 'all' ? undefined : source.kind === 'stack' ? source.name : source.id,
					title
				}),
			openNodes: (envID: EnvironmentID) => nav.push('swarm-nodes', { envID }),
			openNode: (envID: EnvironmentID, node: SwarmNode) => {
				screenCache.set(swarmKeys.node(envID, node.id), node);
				nav.push(`swarm-node/${seg(node.id)}`, { envID });
			},
			openKeyValues: (envID: EnvironmentID, kind: SwarmKeyValueKind) =>
				nav.push('swarm-kv', { envID, kind }),
			openKeyValue: (envID: EnvironmentID, kind: SwarmKeyValueKind, item: SwarmKeyValueItem) => {
				screenCache.set(swarmKeys.kvItem(envID, kind, item.id), item);
				nav.push(`swarm-kv/${seg(item.id)}`, { envID, kind });
			},
			openKeyValueCreate: (envID: EnvironmentID, kind: SwarmKeyValueKind) =>
				nav.push('swarm-kv-create', { envID, kind }),
			openCluster: (envID: EnvironmentID) => nav.push('swarm-cluster', { envID })
		}),
		[nav]
	);
}

export type SwarmNavigation = ReturnType<typeof useSwarmNavigation>;
