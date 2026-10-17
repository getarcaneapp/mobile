import { useCallback, useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import { Volume, type VolumeSizeInfo } from '@/sdk/models/volume/Volume';
import { useClientManager } from '@/stores/client-manager';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import type { ResourceMetadataItem } from '@/ui/components/resource-detail.types';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { useContainerNavigation } from '@/features/containers/container-routes';

import { byteString, capitalized, VolumeRename, volumesChanged } from './volume-model';
import { useVolumeNavigation, volumeCache } from './volume-routes';
import { showErrorAlert } from './volume-support';

const placeholderVolume = (name: string) =>
	Volume.make({ id: name, name, driver: '', mountpoint: '', scope: '', createdAt: '' });

export function useVolumeDetail(environmentID: EnvironmentID, name: string) {
	const nav = useVolumeNavigation();
	const containerNav = useContainerNavigation();
	const accent = useAccentColor();
	const [volume, setVolume] = useState<Volume>(
		() => volumeCache.volume(environmentID, name) ?? placeholderVolume(name)
	);
	const [sizeBytes, setSizeBytes] = useState<number>();
	const [loadingSize, setLoadingSize] = useState(false);
	const [resolvedContainersByID, setResolvedContainersByID] = useState<
		Record<string, ContainerSummary>
	>({});
	useClientManager((s) => s.accessGeneration);

	useEffect(() => {
		if (volumeCache.volume(environmentID, name)) return;
		const client = useClientManager.getState().client;
		if (!client) return;
		let cancelled = false;
		void client.volumes
			.inspect({ envID: environmentID, name })
			.then((value) => {
				if (cancelled) return;
				volumeCache.setVolume(environmentID, value);
				setVolume(value);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [environmentID, name]);

	const loadSize = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setLoadingSize(true);
		try {
			const path = client.rest.environmentPath(environmentID, 'volumes/sizes');
			const sizes = await client.rest.get<VolumeSizeInfo[]>(path);
			setSizeBytes(sizes.find((s) => s.name === name)?.size ?? 0);
		} catch {
		} finally {
			setLoadingSize(false);
		}
	}, [environmentID, name]);

	const containerIDs = volume.containers.join(',');
	const loadConsumers = useCallback(async () => {
		const client = useClientManager.getState().client;
		const cached = cachedClient();
		if (!client || !cached || containerIDs === '') return;
		try {
			const path = client.rest.environmentPath(environmentID, 'containers');
			const containers = await cached.getAllPages<ContainerSummary>(
				path,
				environmentID,
				async (start, limit) => {
					const response = await client.containers.list({
						envID: environmentID,
						query: { start, limit }
					});
					return { items: response.data, pagination: response.pagination };
				}
			);
			const byID: Record<string, ContainerSummary> = {};
			for (const container of containers) byID[container.id] = container;
			setResolvedContainersByID(byID);
		} catch {}
	}, [environmentID, containerIDs]);

	useEffect(() => {
		void loadSize();
	}, [loadSize]);
	useEffect(() => {
		void loadConsumers();
	}, [loadConsumers]);

	const resolvedContainer = (id: string): ContainerSummary | undefined =>
		resolvedContainersByID[id] ??
		Object.values(resolvedContainersByID).find(
			(container) => container.id.startsWith(id) || id.startsWith(container.id)
		);

	const deleteVolume = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			await client.volumes.remove({ envID: environmentID, name: volume.name });
			volumesChanged(environmentID);
			showToast(Toasts.success('Volume deleted'));
		} catch (error) {
			showErrorAlert('Error', friendlyErrorMessage(error));
		}
	};

	const metadata: ResourceMetadataItem[] = [
		{ label: 'Driver', value: volume.driver, systemImage: 'gearshape' },
		{ label: 'Scope', value: capitalized(volume.scope), systemImage: 'scope' },
		{ label: 'Created', value: volume.createdAt, systemImage: 'calendar' },
		{
			label: 'Size',
			value:
				sizeBytes !== undefined ? byteString(sizeBytes) : loadingSize ? 'Loading' : 'Unavailable',
			systemImage: 'internaldrive'
		}
	];

	const overflow: ActionButtonItem[] = [];
	if (VolumeRename.isAvailable(volume, environmentID)) {
		overflow.push({
			id: 'rename',
			title: 'Rename',
			systemImage: 'pencil',
			tint: accent,
			action: () => nav.openRename(environmentID, volume.name, true)
		});
	}
	overflow.push({
		id: 'delete',
		title: 'Delete',
		systemImage: 'trash',
		tint: systemColors.red,
		role: 'destructive',
		action: () => void deleteVolume()
	});

	return {
		environmentID,
		volume,
		metadata,
		resolvedContainer,
		sortedLabels: Object.keys(volume.labels).sort(),
		sortedOptions: Object.keys(volume.options).sort(),
		openBrowse: () => nav.openBrowse(environmentID, volume.name),
		openBackups: () => nav.openBackups(environmentID, volume.name),
		openContainer: (container: ContainerSummary) =>
			containerNav.openDetail(environmentID, container),
		toolbar: {
			primary: {
				id: 'browse',
				title: 'Browse Files',
				systemImage: 'folder',
				tint: accent,
				action: () => nav.openBrowse(environmentID, volume.name)
			} as ActionButtonItem,
			secondary: [
				{
					id: 'backups',
					title: 'Backups',
					systemImage: 'clock.arrow.circlepath',
					tint: accent,
					action: () => nav.openBackups(environmentID, volume.name)
				}
			] as ActionButtonItem[],
			overflow
		}
	};
}

export type VolumeDetailModel = ReturnType<typeof useVolumeDetail>;
