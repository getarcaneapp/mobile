import { useMemo } from 'react';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { Pod } from '@/sdk/models/podman/Pod';
import type { QuadletDetail } from '@/sdk/models/podman/Quadlet';

import { screenCache, useTabRouter } from '@/features/networks/tab-routes';

export const podmanKeys = {
	pod: (env: EnvironmentID, id: string) => `podman-pod:${env}/${id}`,
	quadlet: (env: EnvironmentID, name: string) => `podman-quadlet:${env}/${name}`,
	quadletContent: (env: EnvironmentID, name: string) => `podman-quadlet-content:${env}/${name}`
};

const seg = encodeURIComponent;

export function usePodmanNavigation() {
	const nav = useTabRouter();
	return useMemo(
		() => ({
			nav,
			openPods: (envID: EnvironmentID) => nav.push('podman-pods', { envID }),
			openPod: (envID: EnvironmentID, pod: Pod) => {
				screenCache.set(podmanKeys.pod(envID, pod.id), pod);
				nav.push(`podman-pod/${seg(pod.id)}`, { envID, name: pod.name });
			},
			openQuadlets: (envID: EnvironmentID) => nav.push('podman-quadlets', { envID }),
			openQuadlet: (envID: EnvironmentID, quadlet: QuadletDetail) => {
				screenCache.set(podmanKeys.quadlet(envID, quadlet.name), quadlet);
				nav.push(`podman-quadlet/${seg(quadlet.name)}`, { envID });
			},
			openQuadletEditor: (envID: EnvironmentID, existing?: { name: string; content: string }) => {
				if (existing)
					screenCache.set(podmanKeys.quadletContent(envID, existing.name), existing.content);
				nav.push('podman-quadlet-editor', { envID, name: existing?.name });
			},
			openKube: (envID: EnvironmentID, podName?: string) =>
				nav.push('podman-kube', { envID, pod: podName }),
			openSecrets: (envID: EnvironmentID) => nav.push('podman-secrets', { envID }),
			openSecretForm: (envID: EnvironmentID, name?: string) =>
				nav.push('podman-secret-form', { envID, name }),
			openAutoUpdate: (envID: EnvironmentID) => nav.push('podman-autoupdate', { envID })
		}),
		[nav]
	);
}

export type PodmanNavigation = ReturnType<typeof usePodmanNavigation>;
