import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTabStackGroup } from '@/features/navigation/tab-stack-group';

import { routePayloads } from '@/features/containers/container-routes';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ImageAttestation } from '@/sdk/models/image/ImageAttestation';
import type { ImageDetailSummary } from '@/sdk/models/image/ImageDetail';
import type { ImageSummary } from '@/sdk/models/image/ImageSummary';

const imageKey = (environmentID: EnvironmentID, id: string) => `${environmentID}/${id}`;

const summaries = new Map<string, ImageSummary>();
const details = new Map<string, ImageDetailSummary>();

export const imageCache = {
	setSummary: (environmentID: EnvironmentID, summary: ImageSummary) =>
		summaries.set(imageKey(environmentID, summary.id), summary),
	summary: (environmentID: EnvironmentID, id: string) => summaries.get(imageKey(environmentID, id)),
	setDetails: (environmentID: EnvironmentID, value: ImageDetailSummary, id: string) =>
		details.set(imageKey(environmentID, id), value),
	details: (environmentID: EnvironmentID, id: string) => details.get(imageKey(environmentID, id))
};

type Params = Record<string, string | undefined>;

function query(params: Params) {
	const entries = Object.entries(params).filter(
		(entry): entry is [string, string] => entry[1] !== undefined
	);
	return entries.length === 0
		? ''
		: `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export function useImageNavigation() {
	const router = useRouter();
	const group = useTabStackGroup('(images)');
	return useMemo(() => {
		const href = (path: string, params: Params = {}) =>
			`/(tabs)/${group}/${path}${query(params)}` as Href;
		const imagePath = (id: string, suffix = '') => `image/${encodeURIComponent(id)}${suffix}`;
		return {
			router,
			openDetail: (environmentID: EnvironmentID, summary: ImageSummary) => {
				imageCache.setSummary(environmentID, summary);
				router.push(href(imagePath(summary.id), { envID: environmentID }));
			},
			openTag: (environmentID: EnvironmentID, imageID: string) => {
				router.push(href(imagePath(imageID, '/tag'), { envID: environmentID }));
			},
			openConfigPage: (page: 'env' | 'labels', environmentID: EnvironmentID, imageID: string) => {
				router.push(href(imagePath(imageID, `/${page}`), { envID: environmentID }));
			},
			openAttestation: (
				environmentID: EnvironmentID,
				imageID: string,
				attestation: ImageAttestation
			) => {
				router.push(
					href(imagePath(imageID, '/attestation'), {
						envID: environmentID,
						token: routePayloads.put(attestation)
					})
				);
			},
			openUpdates: (environmentID: EnvironmentID, images: ImageSummary[]) => {
				router.push(
					href('image-updates', { envID: environmentID, token: routePayloads.put(images) })
				);
			},
			openSecurity: (environmentID: EnvironmentID) => {
				router.push(href('imageVulnerabilities', { envID: environmentID }));
			},
			openRegistries: () => {
				router.push(href('containerRegistries'));
			},
			openFilter: (listKey: string) => {
				router.push(href('images-filter', { key: listKey }));
			},
			openPull: (environmentID: EnvironmentID) => {
				router.push(href('image-pull', { envID: environmentID }));
			},
			openUpload: (environmentID: EnvironmentID) => {
				router.push(href('image-upload', { envID: environmentID }));
			},
			openPrune: (environmentID: EnvironmentID) => {
				router.push(href('image-prune', { envID: environmentID }));
			}
		};
	}, [router, group]);
}
