import { AppState } from 'react-native';

import { Permission } from '@/sdk/models/role/Permission';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { usePodmanStatusStore } from '@/stores/podman-status-store';
import { useResourceMutationStore, versionKey } from '@/stores/resource-mutation-store';

export function startPodmanStatusWatcher(): () => void {
	let generation = 0;
	let transport: object | undefined;

	const refresh = async () => {
		generation += 1;
		const token = generation;
		const { authState, apiGeneration, client, currentUser, activeEnvironmentID } =
			useClientManager.getState();
		const store = usePodmanStatusStore.getState();
		if (client?.transport !== transport) {
			transport = client?.transport;
			store.reset();
		}
		const canRead =
			authState === 'authenticated' &&
			apiGeneration === 'v3' &&
			client !== undefined &&
			currentUser !== undefined &&
			User.hasPermission(currentUser, Permission.Podman.read, activeEnvironmentID);
		if (!canRead) {
			store.setStatus(activeEnvironmentID, undefined);
			return;
		}
		const status = await client.podman
			.status({ envID: activeEnvironmentID })
			.catch(() => undefined);
		if (token !== generation || status === undefined) return;
		usePodmanStatusStore.getState().setStatus(activeEnvironmentID, status);
	};

	const unsubscribeClient = useClientManager.subscribe((state, previous) => {
		if (
			state.authState !== previous.authState ||
			state.apiGeneration !== previous.apiGeneration ||
			state.client !== previous.client ||
			state.currentUser !== previous.currentUser ||
			state.activeEnvironmentID !== previous.activeEnvironmentID
		)
			void refresh();
	});
	const unsubscribeMutations = useResourceMutationStore.subscribe((state, previous) => {
		const key = versionKey('podman', useClientManager.getState().activeEnvironmentID);
		if (state.versions[key] !== previous.versions[key]) void refresh();
	});
	const appState = AppState.addEventListener('change', (state) => {
		if (state === 'active') void refresh();
	});
	void refresh();
	return () => {
		generation += 1;
		unsubscribeClient();
		unsubscribeMutations();
		appState.remove();
	};
}
