import { hasPermission } from '@/core/auth/permissions';
import { nonnegative } from '@/core/networking/remote-data-limits';
import { ResponseCache } from '@/core/networking/response-cache';
import { ResourcePruneAction } from '@/core/resource-prune-action';
import { ArcaneError } from '@/sdk/errors/ArcaneError';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { useAllEnvironmentsOperationStore } from '@/stores/all-environments-operation-store';
import { useClientManager } from '@/stores/client-manager';
import { useImageUpdateCountStore } from '@/stores/image-update-count-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import {
	maintenanceActionInfo,
	type AllEnvironmentsMaintenanceAction
} from '@/ui/components/all-environments-maintenance';

export async function performAllEnvironmentsMaintenance(
	action: AllEnvironmentsMaintenanceAction,
	environments: Environment[]
) {
	const manager = useClientManager.getState();
	const client = manager.client;
	if (!client) return;
	const session = manager.clientGeneration;
	const isCurrent = () => useClientManager.getState().clientGeneration === session;
	const markChanged = useResourceMutationStore.getState().markChanged;
	const refreshCount = (id: string) =>
		useImageUpdateCountStore
			.getState()
			.refreshCount(id, client, useClientManager.getState().currentUser?.id);
	const info = maintenanceActionInfo[action];
	await useAllEnvironmentsOperationStore.getState().runWithToast({
		title: info.progressTitle,
		completionTitle: info.completionTitle,
		symbol: info.systemImage,
		environments,
		isCurrent,
		operation: async (id) => {
			if (action === 'checkImages') {
				const result = await client.images.checkAllUpdates({ envID: id });
				if (!isCurrent()) return 'Completed on previous connection';
				markChanged('images', id);
				await refreshCount(id);
				return `Checked ${Object.keys(result).length} image references.`;
			}
			const result = await client.updater.run({ envID: id });
			if (!isCurrent()) return 'Completed on previous connection';
			for (const kind of ['images', 'containers', 'projects'] as const) markChanged(kind, id);
			await refreshCount(id);
			const updated = nonnegative(result.updated);
			const failed = nonnegative(result.failed);
			const skipped = nonnegative(result.skipped);
			if (failed > 0 || result.success === false) {
				throw ArcaneError.transport(`Updated ${updated}; failed ${failed}; skipped ${skipped}.`);
			}
			return `Updated ${updated}; checked ${nonnegative(result.checked)}; skipped ${skipped}.`;
		}
	});
}

export async function performAllEnvironmentsPrune(
	action: ResourcePruneAction,
	environments: Environment[]
) {
	const manager = useClientManager.getState();
	const client = manager.client;
	if (!client) return;
	const session = manager.clientGeneration;
	const isCurrent = () => useClientManager.getState().clientGeneration === session;
	const name = ResourcePruneAction.resourceName(action);
	const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
	await useAllEnvironmentsOperationStore.getState().runWithToast({
		title: `Pruning ${name}…`,
		completionTitle: `${capitalizedName} pruned`,
		symbol: 'trash',
		isDestructive: true,
		environments,
		isCurrent,
		operation: async (id) => {
			if (!hasPermission(ResourcePruneAction.permission(action), id)) {
				throw ArcaneError.transport('Not run: no prune permission');
			}
			await ResourcePruneAction.perform(action, client, id);
			if (!isCurrent()) return 'Completed on previous connection';
			ResponseCache.invalidateEnvironment(id);
			useResourceMutationStore.getState().markChanged(ResourcePruneAction.mutationKind(action), id);
			return `${capitalizedName} pruned`;
		}
	});
}
