import { useRouter, useSegments, type Href } from 'expo-router';
import { useMemo } from 'react';

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
	const segments = useSegments() as string[];
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(images)';
	return useMemo(() => {
		const href = (path: string, params: Params = {}) =>
			`/(tabs)/${group}/${path}${query(params)}` as Href;
		const imagePath = (id: string, suffix = '') => `image/${encodeURIComponent(id)}${suffix}`;
		return {
			router,
			openDetail(this: void, environmentID: EnvironmentID, summary: ImageSummary) {
				imageCache.setSummary(environmentID, summary);
				router.push(href(imagePath(summary.id), { envID: environmentID }));
			},
			openTag(this: void, environmentID: EnvironmentID, imageID: string) {
				router.push(href(imagePath(imageID, '/tag'), { envID: environmentID }));
			},
			openConfigPage(
				this: void,
				page: 'env' | 'labels',
				environmentID: EnvironmentID,
				imageID: string
			) {
				router.push(href(imagePath(imageID, `/${page}`), { envID: environmentID }));
			},
			openAttestation(
				this: void,
				environmentID: EnvironmentID,
				imageID: string,
				attestation: ImageAttestation
			) {
				router.push(
					href(imagePath(imageID, '/attestation'), {
						envID: environmentID,
						token: routePayloads.put(attestation)
					})
				);
			},
			openUpdates(this: void, environmentID: EnvironmentID, images: ImageSummary[]) {
				router.push(
					href('image-updates', { envID: environmentID, token: routePayloads.put(images) })
				);
			},
			openSecurity(this: void, environmentID: EnvironmentID) {
				router.push(href('imageVulnerabilities', { envID: environmentID }));
			},
			openRegistries(this: void) {
				router.push(href('containerRegistries'));
			},
			openFilter(this: void, listKey: string) {
				router.push(href('images-filter', { key: listKey }));
			},
			openPull(this: void, environmentID: EnvironmentID) {
				router.push(href('image-pull', { envID: environmentID }));
			},
			openUpload(this: void, environmentID: EnvironmentID) {
				router.push(href('image-upload', { envID: environmentID }));
			},
			openPrune(this: void, environmentID: EnvironmentID) {
				router.push(href('image-prune', { envID: environmentID }));
			}
		};
	}, [router, group]);
}
