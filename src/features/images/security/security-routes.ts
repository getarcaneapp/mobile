import { router as globalRouter, useRouter, useSegments, type Href } from 'expo-router';
import { useMemo } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { routePayloads } from '@/features/containers/container-routes';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';

import type {
	IgnoredVulnerability,
	VulnerabilityFinding,
	VulnerabilityRecord
} from './vulnerability-model';

type Params = Record<string, string | undefined>;

function query(params: Params) {
	const entries = Object.entries(params).filter(
		(entry): entry is [string, string] => entry[1] !== undefined
	);
	return entries.length === 0
		? ''
		: `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

const groupHref = (group: string, path: string, params: Params = {}) =>
	`/(tabs)/${group}/${path}${query(params)}` as Href;
const imagePath = (id: string, suffix: string) => `image/${encodeURIComponent(id)}${suffix}`;

export type VulnerabilityDetailPayload = {
	record: VulnerabilityRecord;
	ignoreInfo?: IgnoredVulnerability;
};

export type IgnoreVulnerabilityPayload = {
	vulnerability: VulnerabilityRecord;
	imageID: string;
	environmentID: EnvironmentID;
	onIgnored: (record: IgnoredVulnerability) => void;
};

export function canPatchImage(environmentID: EnvironmentID): boolean {
	return (
		hasPermission('images:patch', environmentID) && useClientManager.getState().supportsActivities()
	);
}

export function openImageVulnerabilities(
	envID: EnvironmentID,
	imageID: string,
	name: string,
	group = '(images)'
) {
	globalRouter.push(groupHref(group, imagePath(imageID, '/vulnerabilities'), { envID, name }));
}

export function useSecurityNavigation() {
	const router = useRouter();
	const segments = useSegments() as string[];
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(images)';
	return useMemo(() => {
		const href = (path: string, params: Params = {}) => groupHref(group, path, params);
		return {
			router,
			openImageVulnerabilities(envID: EnvironmentID, imageID: string, name: string) {
				router.push(href(imagePath(imageID, '/vulnerabilities'), { envID, name }));
			},
			openVulnerabilityDetail(payload: VulnerabilityDetailPayload) {
				router.push(href('vulnerability-detail', { token: routePayloads.put(payload) }));
			},
			openFindingDetail(record: VulnerabilityFinding) {
				router.push(href('vulnerability-with-image-detail', { token: routePayloads.put(record) }));
			},
			openIgnore(payload: IgnoreVulnerabilityPayload) {
				router.push(href('vulnerability-ignore', { token: routePayloads.put(payload) }));
			},
			openFilter(listKey: string) {
				router.push(href('security-filter', { key: listKey }));
			},
			openPatchTargets(envID: EnvironmentID) {
				router.push(href('image-patch-targets', { envID }));
			},
			openPatch(envID: EnvironmentID, imageID: string, imageName: string, localOnly = false) {
				router.push(
					href(imagePath(imageID, '/patch'), {
						envID,
						name: imageName,
						localOnly: localOnly ? '1' : undefined
					})
				);
			},
			openImagePatch(envID: EnvironmentID, imageID: string, imageName: string) {
				router.push(href(imagePath(imageID, '/patch'), { envID, name: imageName }));
			}
		};
	}, [router, group]);
}
