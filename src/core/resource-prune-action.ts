import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { ArcaneError } from '@/sdk/errors/ArcaneError';
import { Permission } from '@/sdk/models/role/Permission';
import type { ResourceKind } from '@/stores/resource-mutation-store';

export type ResourcePruneAction = 'containers' | 'images' | 'unusedImages' | 'volumes' | 'networks';

const titles: Record<ResourcePruneAction, string> = {
	containers: 'Prune Stopped Containers',
	images: 'Prune Dangling Images',
	unusedImages: 'Prune All Unused Images',
	volumes: 'Prune Unused Volumes',
	networks: 'Prune Networks'
};

const messages: Record<ResourcePruneAction, string> = {
	containers: 'Remove all stopped containers. This cannot be undone.',
	images: 'Remove all dangling images. This cannot be undone.',
	unusedImages: 'Remove all images not used by a container. This cannot be undone.',
	volumes: 'All unused volumes will be permanently deleted.',
	networks: 'Remove all unused networks.'
};

export const ResourcePruneAction = {
	title: (action: ResourcePruneAction) => titles[action],
	message: (action: ResourcePruneAction) => messages[action],
	allEnvironmentsMessage: (action: ResourcePruneAction) =>
		`${messages[action]} This runs on every enabled environment.`,
	permission(action: ResourcePruneAction): string {
		switch (action) {
			case 'containers':
				return Permission.System.prune;
			case 'images':
			case 'unusedImages':
				return Permission.Images.prune;
			case 'volumes':
				return Permission.Volumes.prune;
			case 'networks':
				return Permission.Networks.prune;
		}
	},
	mutationKind(action: ResourcePruneAction): ResourceKind {
		return action === 'unusedImages' ? 'images' : action;
	},
	resourceName: (action: ResourcePruneAction) => (action === 'unusedImages' ? 'images' : action),

	async perform(
		action: ResourcePruneAction,
		client: ArcaneClient,
		environmentID: EnvironmentID
	): Promise<void> {
		switch (action) {
			case 'containers': {
				const result = await client.system.prune({
					options: { containers: { mode: 'stopped' } },
					envID: environmentID
				});
				if (!result.success)
					throw ArcaneError.transport(result.errors?.join('\n') ?? 'Container prune failed');
				return;
			}
			case 'images':
				await client.images.prune({ envID: environmentID, mode: 'dangling' });
				return;
			case 'unusedImages':
				await client.images.prune({ envID: environmentID, mode: 'all' });
				return;
			case 'volumes':
				await client.volumes.prune({ envID: environmentID });
				return;
			case 'networks':
				await client.networks.prune({ envID: environmentID });
				return;
		}
	}
} as const;
