import { create } from 'zustand';

import { cachedClient } from '@/core/networking/use-cached-client';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { UpdaterResult } from '@/sdk/models/updater/Updater';
import { useClientManager } from '@/stores/client-manager';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { finishActivityToast, showActivityToast, showToast, Toasts } from '@/ui/toast';

export type ContainerDeploymentKind = 'containerRedeploy' | 'containerUpdate';

export type UpdateTarget = { id: string; name: string };

type ContainerDeploymentState = {
	isRunning: boolean;
	start: (args: {
		kind: ContainerDeploymentKind;
		envID: EnvironmentID;
		targetID: string;
		targetName: string;
		environmentName: string;
		updateTargets?: UpdateTarget[];
	}) => boolean;
};

const verb: Record<ContainerDeploymentKind, string> = {
	containerRedeploy: 'Redeploy',
	containerUpdate: 'Update'
};

function failureMessages(result: UpdaterResult): string[] {
	return result.items.flatMap((item) =>
		item.error ? [`${item.resourceName ?? item.resourceId}: ${item.error}`] : []
	);
}

let operationCounter = 0;

export const useContainerDeploymentStore = create<ContainerDeploymentState>((set, get) => ({
	isRunning: false,

	start: ({ kind, envID, targetID, targetName, updateTargets = [] }) => {
		if (get().isRunning) {
			showToast(Toasts.info('Another deployment is running'));
			return false;
		}
		const client = useClientManager.getState().client;
		if (!client) return false;
		const session = useClientManager.getState().clientGeneration;
		const id = `container-deployment-${++operationCounter}`;
		const title = `${verb[kind]} ${targetName}`;
		set({ isRunning: true });
		showActivityToast(id, title);

		void (async () => {
			let failure: string | undefined;
			try {
				if (kind === 'containerRedeploy') {
					await client.containers.redeploy({ envID, id: targetID });
				} else {
					const failures: string[] = [];
					for (const [index, target] of updateTargets.entries()) {
						if (updateTargets.length > 1)
							showActivityToast(id, `Updating ${target.name}`, index / updateTargets.length);
						try {
							const result = await client.updater.updateContainer({
								containerId: target.id,
								envID
							});
							failures.push(...failureMessages(result));
						} catch (error) {
							if (isCancellation(error)) throw error;
							failures.push(`${target.name}: ${friendlyErrorMessage(error)}`);
						}
					}
					const first = failures[0];
					if (first !== undefined)
						failure = failures.length > 1 ? `${first} (+${failures.length - 1} more)` : first;
				}
			} catch (error) {
				failure = isCancellation(error) ? 'Cancelled' : friendlyErrorMessage(error);
			}

			if (useClientManager.getState().clientGeneration !== session) {
				set({ isRunning: false });
				return;
			}
			const cached = cachedClient();
			const envPath = (suffix: string) => client.rest.environmentPath(envID, suffix);
			if (failure === undefined) {
				cached?.invalidate(
					envID,
					kind === 'containerRedeploy'
						? [envPath('containers'), envPath('containers/*')]
						: [
								envPath('containers'),
								envPath('containers/*'),
								envPath('images') + '*',
								envPath('images/*')
							]
				);
				const markChanged = useResourceMutationStore.getState().markChanged;
				markChanged('containers', envID);
				if (kind === 'containerUpdate') {
					markChanged('images', envID);
					markChanged('projects', envID);
					await useImageUpdateCountStore
						.getState()
						.refreshCount(envID, client, useClientManager.getState().currentUser?.id);
				}
				finishActivityToast(id, title, 'success');
			} else {
				useResourceMutationStore.getState().markChanged('containers', envID);
				finishActivityToast(id, title, 'failure');
				showToast(Toasts.error(failure));
			}
			set({ isRunning: false });
		})();
		return true;
	}
}));
