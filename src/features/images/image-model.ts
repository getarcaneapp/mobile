/**
 * Image helpers from Models.swift (`ImageSummary.displayName`),
 * Types/ImageUpdateState.swift (`resolve`, `checkedResults`),
 * Types/ResourceListFilters.swift (`ImageTagsFilter`), and the private
 * helpers of ImagesView / ImageDetailView / ImagePruneView. Pure TS.
 */
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { ImageDetailConfig } from '@/sdk/models/image/ImageDetail';
import type { ImagePruneReport, ImageSummary } from '@/sdk/models/image/ImageSummary';
import { ImageUpdateInfo } from '@/sdk/models/image/ImageUpdateInfo';
import type { ImageUpdateResponse } from '@/sdk/models/imageUpdate/ImageUpdate';
import type { ImageUpdateState } from '@/ui/components/labels.types';

export const untaggedReference = '<none>:<none>';

/** `ImageSummary.displayName`. */
export function imageDisplayName(image: Pick<ImageSummary, 'repoTags' | 'id'>): string {
	return image.repoTags.find((tag) => tag !== untaggedReference) ?? image.id.slice(0, 12);
}

/** Swift `Int64.byteString` (`ByteCountFormatter`, `.file`). */
export function byteString(bytes: number): string {
	return bytes === 0 ? 'Zero KB' : formatFileBytes(bytes);
}

export const taggedReferences = (repoTags: readonly string[]) =>
	repoTags.filter((tag) => tag !== untaggedReference);

// MARK: - ImageTagsFilter

export type ImageTagsFilter = 'All' | 'Tagged' | 'Untagged';
export const ImageTagsFilters: ImageTagsFilter[] = ['All', 'Tagged', 'Untagged'];

// MARK: - ImageUpdateState

/** `ImageUpdateState(info:)`. */
export function imageUpdateStateFromInfo(info: ImageUpdateInfo | undefined): ImageUpdateState {
	if (!info) return { kind: 'unknown' };
	if (info.hasUpdate) return { kind: 'hasUpdate' };
	if (info.error !== '') return { kind: 'error', message: info.error };
	if (ImageUpdateInfo.hasCheckResult(info) || info.checkTime !== undefined)
		return { kind: 'upToDate' };
	return { kind: 'unknown' };
}

/** `ImageUpdateState.checkedResults(_:)`. */
export function checkedUpdateResults(
	info: Record<string, ImageUpdateInfo | undefined>
): Record<string, ImageUpdateResponse> {
	const results: Record<string, ImageUpdateResponse> = {};
	for (const [ref, value] of Object.entries(info)) {
		if (!value || !(ImageUpdateInfo.hasCheckResult(value) || value.checkTime !== undefined))
			continue;
		results[ref] = ImageUpdateInfo.asUpdateResponse(value);
	}
	return results;
}

/** `ImageUpdateState.resolve(inline:references:results:)`. */
export function resolveImageUpdateState(
	inline: ImageUpdateInfo | undefined,
	references: readonly string[],
	results: Readonly<Record<string, ImageUpdateResponse>>
): ImageUpdateState {
	const tags = [...new Set(taggedReferences(references))].sort();
	const checks = tags.flatMap((tag) => (results[tag] ? [results[tag]] : []));
	if (checks.length === 0) return imageUpdateStateFromInfo(inline);
	if (checks.some((check) => check.hasUpdate)) return { kind: 'hasUpdate' };
	const error = checks
		.map((check) => check.error)
		.find((message) => message !== undefined && message !== '');
	if (error !== undefined) return { kind: 'error', message: error };
	if (checks.length !== tags.length) return { kind: 'unknown' };
	return { kind: 'upToDate' };
}

/** ImageDetailView `updateState`: compact badge state from a fetched update response. */
export function updateStateFromResponse(info: ImageUpdateResponse | undefined): ImageUpdateState {
	if (!info) return { kind: 'unknown' };
	if (info.error !== undefined && info.error !== '') return { kind: 'error', message: info.error };
	if (info.hasUpdate) return { kind: 'hasUpdate' };
	return { kind: 'upToDate' };
}

// MARK: - ImageDetailView helpers

const normalizedID = (id: string) => (id.startsWith('sha256:') ? id.slice(7) : id);

function normalizedRef(ref: string): string {
	let r = ref;
	const at = r.indexOf('@');
	if (at >= 0) r = r.slice(0, at); // drop @sha256:… digest
	for (const prefix of [
		'index.docker.io/library/',
		'index.docker.io/',
		'docker.io/library/',
		'docker.io/',
		'library/'
	]) {
		if (r.startsWith(prefix)) {
			r = r.slice(prefix.length);
			break;
		}
	}
	return r;
}

/** ImageDetailView `usesThisImage(_:)`. */
export function containerUsesImage(
	image: Pick<ImageSummary, 'id' | 'repoTags'>,
	container: Pick<ContainerSummary, 'imageId' | 'image'>
): boolean {
	// Primary: same resolved image id (sha), tolerant of short ids / prefix.
	const imageHex = normalizedID(image.id);
	const containerHex = normalizedID(container.imageId);
	if (
		imageHex !== '' &&
		containerHex !== '' &&
		(imageHex === containerHex ||
			imageHex.startsWith(containerHex) ||
			containerHex.startsWith(imageHex))
	) {
		return true;
	}
	// Fallback: the container's image ref matches one of this image's tags,
	// ignoring implicit Docker Hub registry/namespace prefixes and any digest.
	const containerRef = normalizedRef(container.image);
	return image.repoTags.some((tag) => normalizedRef(tag) === containerRef);
}

/** ImageDetailView `ConfigRow`. */
export type ImageConfigRow =
	| { kind: 'value'; label: string; value: string }
	| { kind: 'text'; label: string; value: string }
	| { kind: 'link'; title: string; page: 'env' | 'labels' };

export function imageConfigRows(config: ImageDetailConfig): ImageConfigRow[] {
	const rows: ImageConfigRow[] = [];
	if (config.cmd && config.cmd.length > 0)
		rows.push({ kind: 'value', label: 'CMD', value: config.cmd.join(' ') });
	if (config.entrypoint && config.entrypoint.length > 0)
		rows.push({ kind: 'value', label: 'Entrypoint', value: config.entrypoint.join(' ') });
	if (config.workingDir)
		rows.push({ kind: 'value', label: 'Working Dir', value: config.workingDir });
	if (config.user) rows.push({ kind: 'text', label: 'User', value: config.user });
	if (config.env && config.env.length > 0)
		rows.push({ kind: 'link', title: `Env Vars (${config.env.length})`, page: 'env' });
	const labelCount = config.labels ? Object.keys(config.labels).length : 0;
	if (labelCount > 0) rows.push({ kind: 'link', title: `Labels (${labelCount})`, page: 'labels' });
	return rows;
}

// MARK: - ImagePruneView

export type ImagePruneMode = 'dangling' | 'all' | 'olderThan';

export const ImagePruneModes: { value: ImagePruneMode; title: string }[] = [
	{ value: 'dangling', title: 'Dangling Only' },
	{ value: 'all', title: 'All Unused' },
	{ value: 'olderThan', title: 'Older Than...' }
];

export function imagePruneModeDescription(mode: ImagePruneMode): string {
	switch (mode) {
		case 'dangling':
			return 'Removes only untagged images with no children.';
		case 'all':
			return 'Removes every image not used by a container.';
		case 'olderThan':
			return 'Removes unused images older than the given age (e.g. 24h, 7d).';
	}
}

export function imagePruneResultMessage(report: ImagePruneReport): string {
	const count = report.imagesDeleted.length;
	let message =
		count === 0 ? 'Nothing to remove.' : `Removed ${count} image${count === 1 ? '' : 's'}.`;
	if (report.spaceReclaimed > 0) message += ` Freed ${byteString(report.spaceReclaimed)}.`;
	return message;
}

// MARK: - Pull

/** `DeploymentActivityStore.parseImageNameAndTag(_:)`. */
export function parseImageNameAndTag(raw: string): { name: string; tag?: string } {
	const trimmed = raw.trim();
	const beforeDigest = trimmed.split('@')[0] ?? trimmed;
	// The last ':' is a tag separator only when nothing after it contains '/'
	// (otherwise it's the registry host:port).
	const colon = beforeDigest.lastIndexOf(':');
	if (colon >= 0 && !beforeDigest.slice(colon).includes('/')) {
		const tag = beforeDigest.slice(colon + 1);
		return { name: beforeDigest.slice(0, colon), tag: tag === '' ? undefined : tag };
	}
	return { name: beforeDigest };
}

// MARK: - Updates

/** UpdateRow `versionLine(_:)`. */
export function updateVersionLine(info: ImageUpdateResponse): string {
	const latest = info.latestVersion;
	if (
		latest !== undefined &&
		latest !== '' &&
		info.currentVersion !== '' &&
		latest !== info.currentVersion
	) {
		return `${info.currentVersion} → ${latest}`;
	}
	if (info.updateType !== '') return `Update available (${info.updateType})`;
	return 'Update available';
}

// MARK: - Attestations

/** Friendly names for well-known predicate type URIs (matches the web). */
export function shortPredicateName(type: string): string {
	if (type.includes('slsa.dev/provenance')) return 'SLSA Provenance';
	if (type.includes('spdx')) return 'SPDX SBOM';
	if (type.includes('cyclonedx')) return 'CycloneDX SBOM';
	if (type.includes('vuln')) return 'Vulnerability Scan';
	const last = type.split('/').pop();
	return last !== undefined ? capitalizedWords(last) : type;
}

export function predicateIconName(type: string): string {
	if (type.includes('provenance')) return 'checkmark.seal';
	if (type.includes('spdx') || type.includes('cyclonedx')) return 'shippingbox';
	if (type.includes('vuln')) return 'shield.lefthalf.filled';
	return 'doc.badge.ellipsis';
}

/** Swift `String.capitalized`: uppercases each word's first letter and lowercases the rest. */
export function capitalizedWords(value: string): string {
	return value
		.toLowerCase()
		.replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** `JSONEncoder` with `.prettyPrinted, .sortedKeys, .withoutEscapingSlashes`. */
export function prettySortedJSON(value: unknown): string {
	const sort = (input: unknown): unknown => {
		if (Array.isArray(input)) return input.map(sort);
		if (input !== null && typeof input === 'object') {
			return Object.fromEntries(
				Object.keys(input as Record<string, unknown>)
					.sort()
					.map((key) => [key, sort((input as Record<string, unknown>)[key])])
			);
		}
		return input;
	};
	// Swift's pretty printer separates keys from values with " : ".
	return JSON.stringify(sort(value), null, 2).replace(/^(\s*"(?:[^"\\]|\\.)*"): /gm, '$1 : ');
}
