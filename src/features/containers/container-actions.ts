import * as Haptics from 'expo-haptics';

import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { showToast, Toasts } from '@/ui/toast';

export function lightHaptic() {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function invalidateContainerCaches(environmentID: EnvironmentID) {
	const client = useClientManager.getState().client;
	const cached = cachedClient();
	if (!client || !cached) return;
	cached.invalidate(environmentID, [
		client.rest.environmentPath(environmentID, 'containers'),
		client.rest.environmentPath(environmentID, 'containers/*')
	]);
}

export function containersChanged(environmentID: EnvironmentID) {
	invalidateContainerCaches(environmentID);
	useResourceMutationStore.getState().markChanged('containers', environmentID);
}

export type ContainerLifecycleAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'kill';

export const lifecycleSuccessTitle: Record<ContainerLifecycleAction, string> = {
	start: 'Container started',
	stop: 'Container stopped',
	restart: 'Container restarted',
	pause: 'Container paused',
	unpause: 'Container resumed',
	kill: 'Container killed'
};

const listFailureTitle: Partial<Record<ContainerLifecycleAction, string>> = {
	start: "Couldn't start container",
	stop: "Couldn't stop container",
	restart: "Couldn't restart container",
	kill: "Couldn't kill container"
};

export async function runLifecycle(
	action: ContainerLifecycleAction,
	environmentID: EnvironmentID,
	id: string
) {
	const client = useClientManager.getState().client;
	if (!client) throw new Error('Not connected to a server.');
	const args = { envID: environmentID, id };
	switch (action) {
		case 'start':
			await client.containers.start(args);
			break;
		case 'stop':
			await client.containers.stop(args);
			break;
		case 'restart':
			await client.containers.restart(args);
			break;
		case 'pause':
			await client.containers.pause(args);
			break;
		case 'unpause':
			await client.containers.unpause(args);
			break;
		case 'kill':
			await client.containers.kill(args);
			break;
	}
}

export async function performListAction(
	action: ContainerLifecycleAction,
	environmentID: EnvironmentID,
	id: string
) {
	if (!useClientManager.getState().client) return;
	try {
		await runLifecycle(action, environmentID, id);
		containersChanged(environmentID);
		showToast(Toasts.success(lifecycleSuccessTitle[action]));
	} catch {
		showToast(Toasts.error(listFailureTitle[action] ?? friendlyErrorMessage(undefined)));
	}
}

export async function removeContainer(environmentID: EnvironmentID, id: string): Promise<boolean> {
	const client = useClientManager.getState().client;
	if (!client) return false;
	try {
		await client.containers.delete({ envID: environmentID, id });
		containersChanged(environmentID);
		showToast(Toasts.success('Container removed'));
		return true;
	} catch {
		showToast(Toasts.error("Couldn't remove container"));
		return false;
	}
}
