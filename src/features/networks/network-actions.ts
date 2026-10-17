/** Network mutations shared by NetworksView, NetworkDetailView and the sheets. */
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';

/** `invalidateNetworkCaches(_:)` (+ the container paths when `includeContainers`). */
export function invalidateNetworkCaches(environmentID: EnvironmentID, includeContainers = false) {
	const client = useClientManager.getState().client;
	const cached = cachedClient();
	if (!client || !cached) return;
	const paths = [
		client.rest.environmentPath(environmentID, 'networks'),
		client.rest.environmentPath(environmentID, 'networks/*')
	];
	if (includeContainers) {
		paths.push(
			client.rest.environmentPath(environmentID, 'containers'),
			client.rest.environmentPath(environmentID, 'containers/*')
		);
	}
	cached.invalidate(environmentID, paths);
}

export function networksChanged(environmentID: EnvironmentID) {
	invalidateNetworkCaches(environmentID);
	useResourceMutationStore.getState().markChanged('networks', environmentID);
}

/** `networkMembershipChanged()`: connections change both the network and the container's settings. */
export function networkMembershipChanged(environmentID: EnvironmentID) {
	invalidateNetworkCaches(environmentID, true);
	const store = useResourceMutationStore.getState();
	store.markChanged('networks', environmentID);
	store.markChanged('containers', environmentID);
}

/** `DELETE environments/{id}/networks/{networkID}`. Throws on failure. */
export async function deleteNetworkRequest(environmentID: EnvironmentID, networkID: string) {
	const client = useClientManager.getState().client;
	if (!client) return false;
	await client.rest.delete<unknown>(
		client.rest.environmentPath(environmentID, `networks/${networkID}`)
	);
	return true;
}
