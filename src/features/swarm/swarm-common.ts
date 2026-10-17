/**
 * Port of SwarmCommon.swift: raw Docker JSON accessors, swarm state → badge
 * status mapping, dates, and `swarmChanged(_:)`. Plus the shared swarm
 * navigation (every swarm destination lives once in the tab group).
 */
import { hasPermission } from '@/core/auth/permissions';
import { formattedISO8601 } from '@/core/date-formatting';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { SwarmNode } from '@/sdk/models/swarm/SwarmNode';
import type { JSONValue } from '@/sdk/types/json';
import { useClientManager } from '@/stores/client-manager';
import { useResourceMutationStore, useResourceVersion } from '@/stores/resource-mutation-store';

export type JSONObject = { [key: string]: JSONValue };

/** `JSONValue.swarmObject`. */
export function swarmObject(value: JSONValue | undefined): JSONObject | undefined {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

/** `JSONValue.swarmArray`. */
export function swarmArray(value: JSONValue | undefined): JSONValue[] | undefined {
	return Array.isArray(value) ? value : undefined;
}

/** `JSONValue.swarmString`. */
export function swarmString(value: JSONValue | undefined): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

/** `value[key]`. */
export function swarmField(value: JSONValue | undefined, key: string): JSONValue | undefined {
	return swarmObject(value)?.[key];
}

/** Docker's `{ "Index": N }` object version. */
export function swarmVersionIndex(value: JSONValue | undefined): number | undefined {
	const index = swarmField(value, 'Index');
	if (typeof index !== 'number' || index < 0 || !Number.isFinite(index)) return undefined;
	return Math.trunc(index);
}

/** `SwarmPresentation.badgeStatus(for:)`: Docker swarm states onto the `ResourceStatusBadge` vocabulary. */
export function swarmBadgeStatus(state: string): string {
	switch (state.toLowerCase()) {
		case 'running':
		case 'ready':
		case 'active':
		case 'reachable':
		case 'connected':
			return 'running';
		case 'pending':
		case 'assigned':
		case 'accepted':
		case 'preparing':
		case 'starting':
		case 'new':
		case 'allocated':
		case 'ready_pending':
			return 'starting';
		case 'failed':
		case 'rejected':
		case 'down':
		case 'unreachable':
		case 'orphaned':
		case 'mismatched':
			return 'failed';
		case 'complete':
		case 'completed':
			return 'completed';
		case 'shutdown':
		case 'remove':
		case 'drain':
		case 'disconnected':
		case 'offline':
			return 'stopped';
		case 'pause':
			return 'paused';
		default:
			return state;
	}
}

/** Swift `String.capitalized`. */
export const capitalized = (value: string) =>
	value
		.toLowerCase()
		.replace(/(^|\s)(\S)/g, (_m, space: string, c: string) => space + c.toUpperCase());

/** `SwarmStateBadge` label. */
export const swarmStateLabel = (state: string) => capitalized(state.replace(/_/g, ' '));

/** `SwarmPresentation.date(_:)`. */
export const swarmDate = (value: string) => formattedISO8601(value, 'abbreviated', 'shortened');

/** `ArcaneClientManager.swarmChanged(_:mutationStore:)`. */
export function swarmChanged(environmentID: EnvironmentID) {
	const client = useClientManager.getState().client;
	const cached = cachedClient();
	if (client && cached)
		cached.invalidate(environmentID, [`${client.rest.environmentPath(environmentID, 'swarm')}*`]);
	useResourceMutationStore.getState().markChanged('swarm', environmentID);
}

/** `mutationStore.version(kind: .swarm, envID:)`. */
export const useSwarmVersion = (environmentID: EnvironmentID) =>
	useResourceVersion('swarm', environmentID);

/** `manager.permissions.has(_:in:)`, re-evaluated when access changes. */
export function useCan(environmentID: EnvironmentID) {
	useClientManager((s) => s.accessGeneration);
	useClientManager((s) => s.currentUser);
	return (permission: string) => hasPermission(permission, environmentID);
}

export const nodeIsManager = (node: SwarmNode) => node.role.toLowerCase() === 'manager';
export const nodeIsLeader = (node: SwarmNode) => node.managerStatus?.toLowerCase() === 'leader';

/** `trimmingCharacters(in: .whitespaces)` and empty → nil. */
export function optionalTrimmed(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

export const shortID = (id: string) => id.slice(0, 12);

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
	count === 1 ? singular : pluralForm;
