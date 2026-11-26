import { usePermissionCheck } from '@/core/auth/permissions';
import { formattedISO8601 } from '@/core/date-formatting';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import { useResourceMutationStore, useResourceVersion } from '@/stores/resource-mutation-store';

export function podmanChanged(environmentID: EnvironmentID) {
	const client = useClientManager.getState().client;
	const cached = cachedClient();
	if (client && cached)
		cached.invalidate(environmentID, [`${client.rest.environmentPath(environmentID, 'podman')}*`]);
	const mutations = useResourceMutationStore.getState();
	mutations.markChanged('podman', environmentID);
	mutations.markChanged('containers', environmentID);
}

export const usePodmanVersion = (environmentID: EnvironmentID) =>
	useResourceVersion('podman', environmentID);

export function usePodmanCan(environmentID: EnvironmentID) {
	const can = usePermissionCheck();
	return (permission: string) => can(permission, environmentID);
}

export function podmanDate(value: string | undefined): string {
	if (!value || value.startsWith('0001-')) return '—';
	return formattedISO8601(value, 'abbreviated', 'shortened');
}

export const shortID = (id: string) => id.slice(0, 12);

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
	`${count} ${count === 1 ? singular : pluralForm}`;
