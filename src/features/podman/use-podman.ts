import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import { PodmanStatus } from '@/sdk/models/podman/PodmanStatus';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { usePodmanStatus, usePodmanStatusStore } from '@/stores/podman-status-store';

import { useOnChange } from '@/features/containers/hooks';

import { plural, usePodmanCan, usePodmanVersion } from './podman-common';
import { usePodmanNavigation } from './podman-routes';

export function usePodmanHub(environmentID: EnvironmentID) {
	const client = useClientManager((s) => s.client);
	const status = usePodmanStatus(environmentID);
	const [errorMessage, setErrorMessage] = useState<string>();
	const loading = useRef(false);
	const can = usePodmanCan(environmentID);
	const podman = usePodmanNavigation();

	const load = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current || loading.current) return;
		loading.current = true;
		await withCleanup(
			async () => {
				try {
					const fetched = await current.podman.status({ envID: environmentID });
					usePodmanStatusStore.getState().setStatus(environmentID, fetched);
					setErrorMessage(undefined);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				loading.current = false;
			}
		);
	}, [environmentID]);

	useEffect(() => {
		void load();
	}, [load, client]);
	useOnChange(usePodmanVersion(environmentID), () => void load());

	const canPods = can(Permission.Podman.podsList);
	const canQuadlets = status?.quadletsSupported === true && can(Permission.Podman.quadletsList);
	const canKube = can(Permission.Podman.kubeCreate) || can(Permission.Podman.kubeDelete);
	const canSecrets = can(Permission.Podman.secretsList);
	const canAutoUpdate =
		status !== undefined &&
		PodmanStatus.supportsAutoUpdate(status) &&
		can(Permission.Podman.autoUpdate);

	const details: { title: string; value: string }[] = [];
	if (status?.version) details.push({ title: 'Version', value: status.version });
	if (status?.apiVersion) details.push({ title: 'API Version', value: status.apiVersion });
	if (status?.detected) {
		details.push({ title: 'Mode', value: status.rootless ? 'Rootless' : 'Rootful' });
		details.push({
			title: 'systemd',
			value: status.systemdAvailable
				? status.systemdScope === 'user'
					? 'User session'
					: 'System'
				: 'Unavailable'
		});
	}

	return {
		status,
		errorMessage,
		load,
		details,
		podCountText: status ? plural(status.podCount, 'pod') : '',
		systemdReason: status?.systemdAvailable ? undefined : status?.systemdReason,
		canPods,
		canQuadlets,
		canKube,
		canSecrets,
		canAutoUpdate,
		openPods: () => podman.openPods(environmentID),
		openQuadlets: () => podman.openQuadlets(environmentID),
		openKube: () => podman.openKube(environmentID),
		openSecrets: () => podman.openSecrets(environmentID),
		openAutoUpdate: () => podman.openAutoUpdate(environmentID)
	};
}

export type PodmanHubModel = ReturnType<typeof usePodmanHub>;
