import { randomUUID } from 'expo-crypto';
import { useState, useSyncExternalStore } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { PaginationLoader } from '@/core/networking/pagination-loader';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import { ArcaneRequestOptions } from '@/sdk/http/requestOptions';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type {
	CreateGlobalVariableRequest,
	EnvironmentSyncStatus,
	GlobalVariable,
	UpdateGlobalVariableRequest
} from '@/sdk/models/variable/Variable';
import { VariableSyncState } from '@/sdk/models/variable/Variable';
import { systemColors } from '@/theme/colors';

export type VariableSaveRequest =
	| { kind: 'create'; request: CreateGlobalVariableRequest }
	| { kind: 'update'; id: string; request: UpdateGlobalVariableRequest };

export interface VariablesSnapshot {
	variables: GlobalVariable[];
	environments: Environment[];
	syncStatuses: EnvironmentSyncStatus[];
	isLoading: boolean;
	isSyncing: boolean;
	isUnsupported: boolean;
	errorMessage: string | undefined;
	pollingRevision: number;
}

const initialSnapshot: VariablesSnapshot = {
	variables: [],
	environments: [],
	syncStatuses: [],
	isLoading: false,
	isSyncing: false,
	isUnsupported: false,
	errorMessage: undefined,
	pollingRevision: 0
};

function activityBatchOptions(): ArcaneRequestOptions {
	return ArcaneRequestOptions.withActivityBatchID(randomUUID().toLowerCase());
}

const byKey = (lhs: GlobalVariable, rhs: GlobalVariable) =>
	lhs.key.localeCompare(rhs.key, undefined, { sensitivity: 'base' });

const nonEmpty = (value: string | undefined) => (value ? value : undefined);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isUnknownSyncState = (state: VariableSyncState) => !VariableSyncState.isKnown(state);

export function syncStateDisplayName(state: VariableSyncState): string {
	const value = state
		.replace(/_/g, ' ')
		.toLowerCase()
		.replace(/(^|\s)(\S)/g, (_, space: string, letter: string) => space + letter.toUpperCase());
	return value === '' ? 'Unknown' : value;
}

export class VariablesStore {
	private state: VariablesSnapshot = initialSnapshot;
	private environmentNamesByID = new Map<string, string>();
	private listeners = new Set<() => void>();

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = () => this.state;

	private update(patch: Partial<VariablesSnapshot>) {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener();
	}

	reset() {
		this.environmentNamesByID = new Map();
		this.update(initialSnapshot);
	}

	async load(client: ArcaneClient) {
		if (this.state.variables.length === 0) this.update({ isLoading: true });
		this.update({ errorMessage: undefined });
		try {
			const statusTask = client.variables.syncStatus().catch(() => undefined);
			const environmentTask = PaginationLoader.collect(async (start, limit) => {
				const response = await client.environments.list({
					query: { start, limit, sortBy: 'name', sortOrder: 'asc' }
				});
				return { items: response.data, pagination: response.pagination };
			}).catch(() => undefined);
			const loadedVariables = await client.variables.list();
			const loadedStatuses = await statusTask;
			const loadedEnvironments = await environmentTask;
			const environments = loadedEnvironments ?? [];
			this.environmentNamesByID = new Map(
				environments.map((environment) => [
					environment.id,
					nonEmpty(environment.name) ?? environment.id
				])
			);
			this.update({
				variables: [...loadedVariables].sort(byKey),
				syncStatuses: loadedStatuses ?? [],
				environments,
				isUnsupported: false
			});
			this.requestPollingIfNeeded();
		} catch (error) {
			if (isArcaneError(error, 'notFound')) {
				this.update({ isUnsupported: true, variables: [], syncStatuses: [] });
			} else {
				this.update({ errorMessage: friendlyErrorMessage(error) });
			}
		} finally {
			this.update({ isLoading: false });
		}
	}

	async save(request: VariableSaveRequest, client: ArcaneClient) {
		const options = activityBatchOptions();
		const response =
			request.kind === 'create'
				? await client.variables.create({ request: request.request, options })
				: await client.variables.update({ id: request.id, request: request.request, options });
		const variable = response.variable;
		if (variable) {
			this.update({
				variables: [...this.state.variables.filter((v) => v.id !== variable.id), variable].sort(
					byKey
				)
			});
		}
		this.mergeSyncStatuses(response.syncResults);
		this.requestPolling();
	}

	async delete(variable: GlobalVariable, client: ArcaneClient) {
		const response = await client.variables.delete({
			id: variable.id,
			options: activityBatchOptions()
		});
		this.update({ variables: this.state.variables.filter((v) => v.id !== variable.id) });
		this.mergeSyncStatuses(response.syncResults);
		this.requestPolling();
	}

	async sync(client: ArcaneClient) {
		this.update({ isSyncing: true });
		try {
			const statuses = await client.variables.sync({ options: activityBatchOptions() });
			this.update({ syncStatuses: statuses });
			this.requestPolling();
		} finally {
			this.update({ isSyncing: false });
		}
	}

	async pollPendingSync(client: ArcaneClient, isCancelled: () => boolean) {
		for (let attempt = 0; attempt <= 30; attempt++) {
			if (attempt > 0) await sleep(2000);
			if (isCancelled()) return;
			try {
				const statuses = await client.variables.syncStatus();
				if (isCancelled()) return;
				this.update({ syncStatuses: statuses });
			} catch {
				continue;
			}
			if (!this.state.syncStatuses.some((status) => status.status === VariableSyncState.pending))
				return;
		}
	}

	scopeLabel(variable: GlobalVariable): string {
		if (variable.allEnvironments) return 'All environments';
		if (variable.environmentIDs.length === 0) return 'No environments';
		return variable.environmentIDs.map((id) => this.environmentNamesByID.get(id) ?? id).join(', ');
	}

	private mergeSyncStatuses(statuses: EnvironmentSyncStatus[]) {
		if (statuses.length === 0) return;
		const byID = new Map(this.state.syncStatuses.map((status) => [status.environmentID, status]));
		for (const status of statuses) {
			byID.set(status.environmentID, {
				...status,
				environmentName:
					status.environmentName || this.environmentNamesByID.get(status.environmentID)
			});
		}
		const name = (status: EnvironmentSyncStatus) => status.environmentName ?? status.environmentID;
		this.update({
			syncStatuses: [...byID.values()].sort((lhs, rhs) =>
				name(lhs).localeCompare(name(rhs), undefined, { sensitivity: 'base' })
			)
		});
	}

	private requestPollingIfNeeded() {
		if (this.state.syncStatuses.some((status) => status.status === VariableSyncState.pending))
			this.requestPolling();
	}

	private requestPolling() {
		this.update({ pollingRevision: this.state.pollingRevision + 1 });
	}
}

export function syncSummary(statuses: EnvironmentSyncStatus[]) {
	const failures = statuses.filter((s) => s.status === VariableSyncState.error).length;
	const pending = statuses.filter((s) => s.status === VariableSyncState.pending).length;
	const unknown = statuses.filter((s) => isUnknownSyncState(s.status)).length;
	const plural = (count: number) => (count === 1 ? '' : 's');
	if (failures > 0) {
		return {
			text: `${failures} environment${plural(failures)} failed to sync`,
			icon: 'exclamationmark.triangle.fill',
			color: systemColors.red
		};
	}
	if (pending > 0)
		return {
			text: `${pending} environment${plural(pending)} pending`,
			icon: 'clock.fill',
			color: systemColors.orange
		};
	if (unknown > 0) {
		return {
			text: `${unknown} environment${plural(unknown)} has unknown status`,
			icon: 'questionmark.circle.fill',
			color: undefined
		};
	}
	return {
		text: 'All environments synced',
		icon: 'checkmark.circle.fill',
		color: systemColors.green
	};
}

export function syncStatusPresentation(state: VariableSyncState): {
	icon: string;
	color: string | undefined;
} {
	switch (state) {
		case VariableSyncState.synced:
			return { icon: 'checkmark.circle.fill', color: systemColors.green };
		case VariableSyncState.pending:
			return { icon: 'clock.fill', color: systemColors.orange };
		case VariableSyncState.error:
			return { icon: 'exclamationmark.triangle.fill', color: systemColors.red };
		default:
			return { icon: 'questionmark.circle.fill', color: undefined };
	}
}

export function useVariablesStore(): [VariablesStore, VariablesSnapshot] {
	const [store] = useState(() => new VariablesStore());
	const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
	return [store, snapshot];
}
