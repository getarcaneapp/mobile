/**
 * Shared Jobs logic (JobsListView.swift / JobDetailView.swift): row icon and
 * tint, category grouping, search, the running-jobs set, and the manual run
 * action. Platform-neutral.
 */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { parseArcaneDate } from '@/sdk/models/base/date';
import type { JobStatus } from '@/sdk/models/jobSchedule/JobSchedule';
import { useClientManager } from '@/stores/client-manager';
import type { EnvironmentItem } from '@/stores/environment-paged-list';
import { systemColors } from '@/theme/colors';
import { showToast, Toasts } from '@/ui/toast';
import { relativeTimeFormat } from '@/core/relative-time';

export type JobItem = EnvironmentItem<JobStatus>;

/** `JobRow.icon` / `JobDetailView.icon`. */
export function jobIcon(job: JobStatus, isRunning: boolean): string {
	if (!job.enabled) return 'pause.circle.fill';
	if (isRunning) return 'arrow.triangle.2.circlepath';
	if (job.isContinuous) return 'infinity.circle.fill';
	return 'clock.fill';
}

/** `JobRow.tint` / `JobDetailView.tint`. */
export function jobTint(job: JobStatus, isRunning: boolean): string {
	if (!job.enabled) return systemColors.gray;
	if (isRunning) return systemColors.blue;
	return systemColors.indigo;
}

/** `JobRow.statusBadge`: OFF for disabled jobs, CONT for continuous ones. */
export function jobBadge(job: JobStatus): { text: string; tint: string } | undefined {
	if (!job.enabled) return { text: 'OFF', tint: systemColors.gray };
	if (job.isContinuous) return { text: 'CONT', tint: systemColors.purple };
	return undefined;
}

/** Swift `String.capitalized`. */
export function capitalized(value: string): string {
	return value.replace(
		/[\p{L}\p{N}]+/gu,
		(word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
	);
}

/** `localizedStandardCompare`. */
const standardCompare = (a: string, b: string) =>
	a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const containsInsensitive = (haystack: string, needle: string) =>
	haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());

export type JobGroup = { category: string; jobs: JobItem[] };

/** `filteredJobs()` + `rebuildGroups()`: search, then group by category (empty → "Other"). */
export function jobGroups(
	jobs: readonly JobItem[],
	searchText: string
): { groups: JobGroup[]; filteredCount: number } {
	const trimmed = searchText.trim();
	const filtered =
		trimmed === ''
			? [...jobs]
			: jobs.filter(
					(job) =>
						containsInsensitive(job.value.name, trimmed) ||
						containsInsensitive(job.value.description, trimmed) ||
						containsInsensitive(job.value.category, trimmed)
				);
	const byCategory = new Map<string, JobItem[]>();
	for (const job of filtered) {
		const key = job.value.category === '' ? 'Other' : job.value.category;
		const list = byCategory.get(key) ?? [];
		list.push(job);
		byCategory.set(key, list);
	}
	const groups = [...byCategory.keys()]
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
		.map((category) => ({
			category,
			jobs: (byCategory.get(category) ?? []).sort((a, b) => {
				const order = standardCompare(a.value.name, b.value.name);
				if (order !== 0) return order;
				return standardCompare(a.environmentName ?? '', b.environmentName ?? '');
			})
		}));
	return { groups, filteredCount: filtered.length };
}

/** `Text(next, format: .relative(presentation: .named))`. */
export function relativeNamed(value: string | undefined, now = Date.now()): string | undefined {
	const date = value ? parseArcaneDate(value) : undefined;
	if (!date) return undefined;
	const seconds = Math.round((date.getTime() - now) / 1000);
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

// MARK: - Running jobs + run action

/** `runningJobs` (keyed by `EnvironmentItem.id`), shared by the list and a pushed detail. */
export const useRunningJobs = create<{ ids: ReadonlySet<string> }>(() => ({
	ids: new Set<string>()
}));

function setRunning(id: string, running: boolean) {
	const next = new Set(useRunningJobs.getState().ids);
	if (running) next.add(id);
	else next.delete(id);
	useRunningJobs.setState({ ids: next });
}

/** `JobsListView.run(_:)`. */
export async function runJob(job: JobItem): Promise<void> {
	const client = useClientManager.getState().client;
	if (!client || useRunningJobs.getState().ids.has(job.id)) return;
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
	setRunning(job.id, true);
	try {
		const result = await client.jobs.run({ jobID: job.value.id, envID: job.environmentID });
		const message = result.message === '' ? `${job.value.name} started` : result.message;
		showToast(Toasts.success(message));
	} catch (error) {
		showToast(Toasts.error(friendlyErrorMessage(error)));
	} finally {
		setRunning(job.id, false);
	}
}

export function copyJobName(job: JobStatus) {
	void Clipboard.setStringAsync(job.name);
	showToast(Toasts.copied('Job name copied'));
}

export function copyJobSchedule(job: JobStatus) {
	void Clipboard.setStringAsync(job.schedule);
	showToast(Toasts.copied('Schedule copied'));
}

// MARK: - Pushed detail hand-off

const jobCache = new Map<string, JobItem>();
const cacheKey = (environmentID: EnvironmentID, jobID: string) => `${environmentID}/${jobID}`;

export const jobItemCache = {
	set: (item: JobItem) => jobCache.set(cacheKey(item.environmentID, item.value.id), item),
	get: (environmentID: EnvironmentID, jobID: string) => jobCache.get(cacheKey(environmentID, jobID))
};
