import {
	boundedAPIResponse,
	boundedData,
	boundedText,
	nonnegative,
	RemoteDataLimits
} from '@/core/networking/remote-data-limits';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { parseArcaneJSON } from '@/sdk/http/json';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { ImageSummary, ImageUsedBy } from '@/sdk/models/image/ImageSummary';
import { ImageUpdateInfo } from '@/sdk/models/image/ImageUpdateInfo';
import type { ImageUpdateResponse, ImageUpdateSummary } from '@/sdk/models/imageUpdate/ImageUpdate';
import type {
	AutoUpdateRecord,
	UpdaterResourceResult,
	UpdaterResult,
	UpdaterStatus
} from '@/sdk/models/updater/Updater';
import { UpdaterResult as UpdaterResultModel } from '@/sdk/models/updater/Updater';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { systemColors } from '@/theme/colors';
import type { JSONValue } from '@/sdk/types/json';
import { relativeTimeFormat } from '@/core/relative-time';

export function capitalized(value: string): string {
	return value
		.toLowerCase()
		.replace(
			/(^|[^\p{L}\p{N}'])(\p{L})/gu,
			(_, prefix: string, letter: string) => prefix + letter.toUpperCase()
		);
}

export function containsInsensitive(haystack: string, needle: string): boolean {
	return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

export function relativeNamed(ms: number, now = Date.now()): string {
	const seconds = Math.round((ms - now) / 1000);
	const format = relativeTimeFormat();
	const abs = Math.abs(seconds);
	if (abs < 60) return format.format(seconds, 'second');
	if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
	if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
	if (abs < 86400 * 7) return format.format(Math.round(seconds / 86400), 'day');
	if (abs < 86400 * 30) return format.format(Math.round(seconds / (86400 * 7)), 'week');
	if (abs < 86400 * 365) return format.format(Math.round(seconds / (86400 * 30)), 'month');
	return format.format(Math.round(seconds / (86400 * 365)), 'year');
}

export function abbreviatedDuration(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const secs = total % 60;
	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
	return parts.join(' ');
}

const goDurationUnits: Record<string, number> = {
	h: 3600,
	m: 60,
	s: 1,
	ms: 0.001,
	us: 0.000001,
	µs: 0.000001,
	ns: 0.000000001
};

export function goDurationSeconds(text: string): number | undefined {
	const trimmed = text.trim();
	if (!/^(\d+(\.\d+)?(h|m|s|ms|us|µs|ns))+$/.test(trimmed)) return undefined;
	let total = 0;
	for (const match of trimmed.matchAll(/(\d+(?:\.\d+)?)(ms|us|µs|ns|h|m|s)/g)) {
		total += Number(match[1]) * (goDurationUnits[match[2] ?? ''] ?? 0);
	}
	return total;
}

export function updaterDurationText(text: string): string {
	const seconds = goDurationSeconds(text);
	if (seconds === undefined) return text;
	return seconds < 1 ? 'under 1s' : abbreviatedDuration(seconds);
}

export function splitRefTag(ref: string): { repo: string; tag?: string } {
	const colon = ref.lastIndexOf(':');
	if (colon < 0) return { repo: ref };
	const tail = ref.slice(colon + 1);
	if (tail.includes('/')) return { repo: ref };
	return { repo: ref.slice(0, colon), tag: tail };
}

export function normalizedRef(ref: string): string {
	let value = ref.trim().toLowerCase();
	const at = value.indexOf('@');
	if (at >= 0) value = value.slice(0, at);
	if (splitRefTag(value).tag === undefined) value += ':latest';
	return value;
}

export function containerName(container: ContainerSummary): string {
	const first = container.names[0];
	if (first !== undefined) return first.startsWith('/') ? first.slice(1) : first;
	return container.id.slice(0, 12);
}

export interface EnvUpdateBucket {
	id: string;
	env: Environment;
	summary?: ImageUpdateSummary;
	images: ImageSummary[];
	byRef: Record<string, ImageUpdateResponse>;
	totalImages: number;
	loading: boolean;
	error?: string;
}

export function makeBucket(env: Environment, loading = false): EnvUpdateBucket {
	return { id: env.id, env, images: [], byRef: {}, totalImages: 0, loading };
}

export interface OutdatedImage {
	id: string;
	image: ImageSummary;
	ref: string;
	info: ImageUpdateResponse;
}

export const OutdatedImage = {
	make(image: ImageSummary, ref: string, info: ImageUpdateResponse): OutdatedImage {
		return { id: image.id, image, ref, info };
	},
	consumers(item: OutdatedImage): ImageUsedBy[] {
		return item.image.usedBy ?? [];
	},
	repoDisplayName(item: OutdatedImage): string {
		const repo = splitRefTag(item.ref).repo;
		const parts = repo.split('/').filter((part) => part !== '');
		return parts[parts.length - 1] ?? repo;
	},
	versionChange(item: OutdatedImage): string {
		const current =
			item.info.currentVersion === '' ? splitRefTag(item.ref).tag : item.info.currentVersion;
		const latest = item.info.latestVersion;
		if (
			latest !== undefined &&
			latest !== '' &&
			current !== undefined &&
			current !== '' &&
			latest !== current
		) {
			return `${current} → ${latest}`;
		}
		if (item.info.updateType.toLowerCase() === 'digest') {
			return `New digest for ${splitRefTag(item.ref).tag ?? 'this tag'}`;
		}
		return item.ref;
	}
} as const;

export function primaryRef(image: ImageSummary): string | undefined {
	return image.repoTags.find((tag) => tag !== '<none>:<none>');
}

export function resolvedInfo(
	image: ImageSummary,
	ref: string,
	bucket: EnvUpdateBucket
): ImageUpdateResponse | undefined {
	const cached = bucket.byRef[ref];
	if (cached) return cached;
	const inline = image.updateInfo;
	if (inline && ImageUpdateInfo.hasCheckResult(inline))
		return ImageUpdateInfo.asUpdateResponse(inline);
	return undefined;
}

export function outdatedImages(bucket: EnvUpdateBucket): OutdatedImage[] {
	const items: OutdatedImage[] = [];
	for (const image of bucket.images) {
		const ref = primaryRef(image);
		if (ref === undefined) continue;
		const info = resolvedInfo(image, ref, bucket);
		if (!info?.hasUpdate) continue;
		items.push(OutdatedImage.make(image, ref, info));
	}
	return items.sort((a, b) =>
		OutdatedImage.repoDisplayName(a).localeCompare(OutdatedImage.repoDisplayName(b), undefined, {
			sensitivity: 'base'
		})
	);
}

export function updateCount(bucket: EnvUpdateBucket): number {
	const rows = outdatedImages(bucket).length;
	if (rows === 0 && bucket.loading && bucket.summary) return bucket.summary.imagesWithUpdates;
	return rows;
}

export function actionableConsumers(item: OutdatedImage): ImageUsedBy[] {
	return OutdatedImage.consumers(item).filter(
		(consumer) => consumer.name.trim() !== '' || (consumer.id ?? '').trim() !== ''
	);
}

export function rowKey(bucketID: string, suffix: string): string {
	return `${bucketID}::${suffix}`;
}

export function updateTypeBadge(
	info: ImageUpdateResponse
): { text: string; tint: string } | undefined {
	const type = info.updateType;
	if (type === '') return undefined;
	const digest = type.toLowerCase() === 'digest';
	return {
		text: digest ? 'Digest' : capitalized(type),
		tint: digest ? systemColors.blue : systemColors.orange
	};
}

export type UpdateTarget = { id: string; name: string };

export function resolveUpdateTargets(
	consumers: ImageUsedBy[],
	item: OutdatedImage,
	fresh: ContainerSummary[]
): UpdateTarget[] {
	const matches = (container: ContainerSummary) =>
		container.imageId === item.image.id ||
		normalizedRef(container.image) === normalizedRef(item.ref);
	const targets: UpdateTarget[] = [];
	for (const consumer of consumers) {
		if (consumer.type === 'project') {
			const projectName = consumer.name.toLowerCase();
			const inProject = fresh.filter(
				(c) => (c.labels?.['com.docker.compose.project'] ?? '').toLowerCase() === projectName
			);
			const runningThisImage = inProject.filter(matches);
			for (const c of runningThisImage.length === 0 ? inProject : runningThisImage) {
				targets.push({ id: c.id, name: containerName(c) });
			}
		} else {
			const match = fresh.find((c) => c.id === consumer.id || containerName(c) === consumer.name);
			if (match) targets.push({ id: match.id, name: containerName(match) });
			else if (consumer.id !== undefined) targets.push({ id: consumer.id, name: consumer.name });
		}
	}
	const seen = new Set<string>();
	return targets.filter((target) => {
		if (seen.has(target.id)) return false;
		seen.add(target.id);
		return true;
	});
}

export function resourceTypeIcon(resourceType: string): string {
	switch (resourceType.toLowerCase()) {
		case 'container':
			return 'shippingbox.fill';
		case 'project':
		case 'stack':
			return 'folder.fill';
		case 'image':
			return 'square.3.layers.3d.top.filled';
		default:
			return 'arrow.triangle.2.circlepath';
	}
}

export function resourceTypeTint(resourceType: string): string {
	switch (resourceType.toLowerCase()) {
		case 'container':
			return systemColors.blue;
		case 'project':
		case 'stack':
			return systemColors.purple;
		case 'image':
			return systemColors.pink;
		default:
			return systemColors.gray;
	}
}

type StatusFields = {
	error?: string;
	updateApplied?: boolean;
	updateAvailable?: boolean;
	status: string;
};

export function updaterStatusText(item: StatusFields): string {
	if (item.error !== undefined && item.error !== '') return 'Failed';
	if (item.updateApplied === true) return 'Updated';
	if (item.updateAvailable === true) return 'Available';
	return capitalized(item.status);
}

export function updaterStatusTint(item: StatusFields, includesUpToDate: boolean): string {
	if (item.error !== undefined && item.error !== '') return systemColors.red;
	if (item.updateApplied === true) return systemColors.green;
	if (item.updateAvailable === true) return systemColors.orange;
	switch (item.status.toLowerCase()) {
		case 'skipped':
		case 'ignored':
			return systemColors.gray;
		case 'up_to_date':
			return includesUpToDate ? systemColors.gray : systemColors.blue;
		case 'failed':
		case 'error':
			return systemColors.red;
		case 'updated':
		case 'success':
			return systemColors.green;
		default:
			return systemColors.blue;
	}
}

export function historyBadgeTint(record: AutoUpdateRecord): string {
	if (record.error !== undefined && record.error !== '') return systemColors.red;
	if (record.updateApplied) return systemColors.green;
	if (record.updateAvailable) return systemColors.orange;
	return systemColors.blue;
}

export function imageChange(
	oldVersions: Record<string, string>,
	newVersions: Record<string, string>
): string | undefined {
	const key = Object.keys(newVersions)[0] ?? Object.keys(oldVersions)[0];
	if (key === undefined) return undefined;
	const oldTag = oldVersions[key];
	const newTag = newVersions[key];
	if (oldTag !== undefined && newTag !== undefined && oldTag !== newTag)
		return `${oldTag} → ${newTag}`;
	if (oldTag !== undefined) return oldTag;
	if (newTag !== undefined) return newTag;
	return undefined;
}

export function resultImageChange(item: UpdaterResourceResult): string | undefined {
	return imageChange(item.oldImages ?? {}, item.newImages ?? {});
}

export function flattenVersions(
	values: Record<string, JSONValue> | undefined
): Record<string, string> {
	const out: Record<string, string> = {};
	if (!values) return out;
	for (const [key, value] of Object.entries(values)) {
		if (typeof value === 'string') out[key] = value;
	}
	return out;
}

function boundedIDs(ids: string[]): string[] {
	return ids.slice(0, RemoteDataLimits.maximumUpdaterStatusIDs).map((id) => boundedText(id, 512));
}

export function boundedUpdaterStatus(status: UpdaterStatus): UpdaterStatus {
	return {
		updatingContainers: nonnegative(status.updatingContainers ?? 0),
		updatingProjects: nonnegative(status.updatingProjects ?? 0),
		containerIds: boundedIDs(status.containerIds ?? []),
		projectIds: boundedIDs(status.projectIds ?? [])
	};
}

function boundedUpdaterItem(item: UpdaterResourceResult): UpdaterResourceResult {
	return {
		...item,
		resourceId: boundedText(item.resourceId, 512),
		resourceName: item.resourceName === undefined ? undefined : boundedText(item.resourceName, 512),
		resourceType: boundedText(item.resourceType, 128),
		status: boundedText(item.status, 128),
		error: item.error === undefined ? undefined : boundedText(item.error, 4096)
	};
}

export function boundedUpdaterResult(result: UpdaterResult): UpdaterResult {
	return {
		success: result.success,
		checked: nonnegative(result.checked),
		updated: nonnegative(result.updated),
		skipped: nonnegative(result.skipped),
		failed: nonnegative(result.failed),
		startTime: result.startTime === undefined ? undefined : boundedText(result.startTime, 256),
		endTime: result.endTime === undefined ? undefined : boundedText(result.endTime, 256),
		duration: boundedText(result.duration, 256),
		items: result.items.slice(0, RemoteDataLimits.maximumUpdaterItems).map(boundedUpdaterItem),
		activityID: result.activityID === undefined ? undefined : boundedText(result.activityID, 512)
	};
}

export async function runBoundedUpdater(
	client: ArcaneClient,
	environmentID: EnvironmentID,
	signal?: AbortSignal
): Promise<UpdaterResult> {
	const path = client.rest.environmentPath(environmentID, 'updater/run');
	const data = await boundedData(client, path, { method: 'POST', signal });
	const envelope = parseArcaneJSON(new TextDecoder().decode(data)) as { data: unknown };
	return boundedUpdaterResult(UpdaterResultModel.decode(envelope.data));
}

export async function loadBoundedUpdaterStatus(
	client: ArcaneClient,
	environmentID: EnvironmentID,
	signal?: AbortSignal
): Promise<UpdaterStatus> {
	const status = await boundedAPIResponse<UpdaterStatus>(
		client,
		client.rest.environmentPath(environmentID, 'updater/status'),
		{ signal }
	);
	return boundedUpdaterStatus(status);
}
