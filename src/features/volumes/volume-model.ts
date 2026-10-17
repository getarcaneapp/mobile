/**
 * Platform-neutral logic for the Volumes screens (VolumesView.swift,
 * Types/ResourceListFilters.swift `VolumeScopeFilter`, `VolumeRename`), plus
 * the shared cache/mutation helpers every volume screen uses.
 */
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';

import { hasPermission } from '@/core/auth/permissions';
import { ListSortOrder } from '@/core/list-sort-order';
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import { escapedPathComponent } from '@/core/networking/server-identity';
import { cachedClient } from '@/core/networking/use-cached-client';
import type { EnvironmentID } from '@/sdk/client/environment';
import { ArcaneError } from '@/sdk/errors/ArcaneError';
import { parseArcaneDate } from '@/sdk/models/base/date';
import { Volume } from '@/sdk/models/volume/Volume';
import { useClientManager } from '@/stores/client-manager';
import type { EnvironmentItem } from '@/stores/environment-paged-list';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import type { StableListSection } from '@/ui/components/stable-sectioned-list.types';
import { showToast, Toasts } from '@/ui/toast';
import { relativeTimeFormat } from '@/core/relative-time';

/** Port of `VolumeScopeFilter` (Types/ResourceListFilters.swift). Raw values are the titles. */
export type VolumeScopeFilter = 'All' | 'Local' | 'Global';
export const VolumeScopeFilters: readonly VolumeScopeFilter[] = ['All', 'Local', 'Global'];

export type VolumeItem = EnvironmentItem<Volume>;
export type VolumeSectionID = 'pinned' | 'used' | 'unused';
export type VolumeSection = StableListSection<VolumeSectionID, VolumeItem>;

/** `HapticsManager.light()`. */
export function lightHaptic() {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** `String.localizedCaseInsensitiveContains`. */
export function containsCaseInsensitive(value: string, query: string) {
	return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

/** `String.capitalized`: every word starts uppercase, the rest lowercase. */
export function capitalized(value: string) {
	return value
		.toLocaleLowerCase()
		.replace(
			/(^|\s)(\S)/g,
			(_m, space: string, letter: string) => space + letter.toLocaleUpperCase()
		);
}

/** `Int64.byteString` (ByteCountFormatter, `.file`). */
export const byteString = formatFileBytes;

/** VolumesView `computeSections`: filter + sort once, partition into Pinned / Used / Unused. */
export function computeVolumeSections(
	volumes: readonly VolumeItem[],
	filter: {
		search: string;
		environmentFilter?: string;
		scopeFilter: VolumeScopeFilter;
		sortOrder: ListSortOrder;
	},
	pinned: ReadonlySet<string>
): VolumeSection[] {
	const query = filter.search;
	const filtered = volumes
		.filter((volume) => {
			if (
				filter.environmentFilter !== undefined &&
				volume.environmentID !== filter.environmentFilter
			)
				return false;
			const matchesSearch =
				query === '' ||
				containsCaseInsensitive(volume.value.name, query) ||
				containsCaseInsensitive(volume.value.driver, query);
			const scope = volume.value.scope.toLowerCase();
			const matchesScope =
				filter.scopeFilter === 'All' ||
				(filter.scopeFilter === 'Local' && scope === 'local') ||
				(filter.scopeFilter === 'Global' && scope !== 'local');
			return matchesSearch && matchesScope;
		})
		.sort((lhs, rhs) => ListSortOrder.compare(filter.sortOrder, lhs.value.name, rhs.value.name));
	const pinnedItems: VolumeItem[] = [];
	const used: VolumeItem[] = [];
	const unused: VolumeItem[] = [];
	for (const volume of filtered) {
		if (pinned.has(volume.id)) pinnedItems.push(volume);
		else if (volume.value.inUse) used.push(volume);
		else unused.push(volume);
	}
	return [
		{ id: 'pinned', title: 'Pinned', items: pinnedItems },
		{ id: 'used', title: 'Used', items: used },
		{ id: 'unused', title: 'Unused', items: unused }
	];
}

/** `VolumeRow.subtitleParts`. */
export function volumeSubtitleParts(volume: Volume, size: number | undefined): string[] {
	const parts: string[] = [];
	if (size !== undefined && size > 0) parts.push(byteString(size));
	if (volume.driver.toLowerCase() !== 'local') parts.push(volume.driver);
	return parts;
}

/** `VolumeRow.accessibilityDescription`. */
export function volumeAccessibilityDescription(
	volume: Volume,
	size: number | undefined,
	isPinned: boolean,
	environmentName?: string
) {
	const parts = [volume.name];
	if (isPinned) parts.push('pinned');
	parts.push(volume.inUse ? 'in use' : 'unused');
	const subtitle = volumeSubtitleParts(volume, size);
	if (subtitle.length > 0) parts.push(subtitle.join(', '));
	if (environmentName) parts.push(environmentName);
	return parts.join(', ');
}

/** VolumesView `volumePreview` details. */
export function volumePreviewDetails(item: VolumeItem, size: number | undefined) {
	const volume = item.value;
	const details: { icon: string; label: string; value: string }[] = [
		{ icon: 'gearshape', label: 'Driver', value: volume.driver },
		{ icon: 'globe', label: 'Scope', value: capitalized(volume.scope) }
	];
	if (size !== undefined && size > 0)
		details.unshift({ icon: 'internaldrive', label: 'Size', value: byteString(size) });
	if (volume.mountpoint !== '')
		details.push({ icon: 'folder', label: 'Mount Point', value: volume.mountpoint });
	if (item.environmentName)
		details.push({ icon: 'server.rack', label: 'Environment', value: item.environmentName });
	return details;
}

// MARK: - Caches

/** `invalidateVolumeCaches(_:)`. */
export function invalidateVolumeCaches(environmentID: EnvironmentID) {
	const client = useClientManager.getState().client;
	const cached = cachedClient();
	if (!client || !cached) return;
	cached.invalidate(environmentID, [
		client.rest.environmentPath(environmentID, 'volumes'),
		client.rest.environmentPath(environmentID, 'volumes/sizes'),
		client.rest.environmentPath(environmentID, 'volumes/*')
	]);
}

/** Invalidate + bump the volumes mutation version so every list/detail reloads. */
export function volumesChanged(environmentID: EnvironmentID) {
	invalidateVolumeCaches(environmentID);
	useResourceMutationStore.getState().markChanged('volumes', environmentID);
}

// MARK: - VolumeRename

/**
 * Volume rename copies the data to a new volume and removes the source, so the
 * server only allows it for volumes no container uses (v2.9+).
 */
export const VolumeRename = {
	footer:
		"The data is copied to a new volume and the old one is removed. The volume can't be in use by any container.",
	isAvailable: (volume: Volume, envID: EnvironmentID) =>
		volume.containers.length === 0 && hasPermission('volumes:rename', envID),
	/** Throws on failure. */
	async perform(from: string, to: string, envID: EnvironmentID): Promise<void> {
		const client = useClientManager.getState().client;
		if (!client) throw ArcaneError.transport('No client');
		const path = client.rest.environmentPath(envID, `volumes/${escapedPathComponent(from)}/rename`);
		await client.rest.post(path, { body: { name: to }, decode: Volume.decode });
		volumesChanged(envID);
		showToast(Toasts.success('Volume renamed'));
	}
} as const;

/** `RenameContainerSheet.nameRegex`. */
export const resourceNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/;

// MARK: - Formatting

/** `Text(date, format: .relative(presentation: .named))`. */
export function relativeNamed(value: string | undefined): string {
	const date = parseArcaneDate(value);
	if (!date) return value ?? '';
	const seconds = Math.round((date.getTime() - Date.now()) / 1000);
	const abs = Math.abs(seconds);
	const [amount, unit]: [number, Intl.RelativeTimeFormatUnit] =
		abs < 60
			? [seconds, 'second']
			: abs < 3600
				? [Math.round(seconds / 60), 'minute']
				: abs < 86_400
					? [Math.round(seconds / 3600), 'hour']
					: abs < 604_800
						? [Math.round(seconds / 86_400), 'day']
						: abs < 2_629_800
							? [Math.round(seconds / 604_800), 'week']
							: abs < 31_557_600
								? [Math.round(seconds / 2_629_800), 'month']
								: [Math.round(seconds / 31_557_600), 'year'];
	try {
		return relativeTimeFormat().format(amount, unit);
	} catch {
		return date.toLocaleString();
	}
}

/** A fresh `UUID().uuidString`. */
export const uuidString = () => randomUUID().toUpperCase();
