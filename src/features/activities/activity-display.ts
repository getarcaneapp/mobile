import { EnvironmentID } from '@/sdk/client/environment';
import type {
	Activity,
	ActivityMessageLevel,
	ActivityStartedBy,
	ActivityStatus
} from '@/sdk/models/activity/Activity';
import { parseArcaneDate } from '@/sdk/models/base/date';
import { systemColors } from '@/theme/colors';
import { relativeTimeFormat } from '@/core/relative-time';

export type ActivityStatusFilter =
	| 'all'
	| 'active'
	| 'queued'
	| 'running'
	| 'failed'
	| 'completed'
	| 'cancelled';

export const ActivityStatusFilter = {
	allCases: [
		'all',
		'active',
		'queued',
		'running',
		'failed',
		'completed',
		'cancelled'
	] as const satisfies readonly ActivityStatusFilter[],

	title(filter: ActivityStatusFilter): string {
		switch (filter) {
			case 'all':
				return 'All';
			case 'active':
				return 'Active';
			case 'queued':
				return 'Queued';
			case 'running':
				return 'Running';
			case 'failed':
				return 'Failed';
			case 'completed':
				return 'Completed';
			case 'cancelled':
				return 'Cancelled';
		}
	},

	systemImage(filter: ActivityStatusFilter): string {
		switch (filter) {
			case 'all':
				return 'tray.full';
			case 'active':
				return 'bolt.circle';
			case 'queued':
				return 'clock';
			case 'running':
				return 'play.circle';
			case 'failed':
				return 'xmark.octagon';
			case 'completed':
				return 'checkmark.circle';
			case 'cancelled':
				return 'slash.circle';
		}
	},

	matches(filter: ActivityStatusFilter, activity: Activity): boolean {
		switch (filter) {
			case 'all':
				return true;
			case 'active':
				return activity.status === 'queued' || activity.status === 'running';
			case 'queued':
				return activity.status === 'queued';
			case 'running':
				return activity.status === 'running';
			case 'failed':
				return activity.status === 'failed';
			case 'completed':
				return activity.status === 'success';
			case 'cancelled':
				return activity.status === 'cancelled';
		}
	}
} as const;

export function capitalizedWords(text: string): string {
	return text.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function activityDisplayName(raw: string): string {
	return raw
		.split('_')
		.filter((part) => part !== '')
		.map(capitalizedWords)
		.join(' ');
}

export function sortedUnique(values: readonly string[]): string[] {
	return [...new Set(values.filter((value) => value !== ''))].sort((a, b) =>
		a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
	);
}

export type ActivityTint = 'secondary' | (string & {});

export function activityStatusTint(status: ActivityStatus): ActivityTint {
	switch (status) {
		case 'running':
			return systemColors.blue;
		case 'queued':
			return systemColors.orange;
		case 'success':
			return systemColors.green;
		case 'failed':
			return systemColors.red;
		default:
			return 'secondary';
	}
}

export function dateMs(value: string | undefined): number {
	return parseArcaneDate(value)?.getTime() ?? 0;
}

export const ActivityDisplay = {
	displayProgress(this: void, activity: Activity): number | undefined {
		if (activity.status === 'success') return 100;
		return activity.progress === undefined
			? undefined
			: Math.min(Math.max(activity.progress, 0), 100);
	},

	isCancellable(this: void, activity: Activity): boolean {
		return activity.status === 'queued' || activity.status === 'running';
	},

	displayTitle(this: void, activity: Activity): string {
		const name = activity.resourceName?.trim() ?? '';
		return name === '' ? activityDisplayName(activity.type) : name;
	},

	subtitle(this: void, activity: Activity): string {
		const resource =
			activity.resourceType !== undefined
				? activityDisplayName(activity.resourceType)
				: activityDisplayName(activity.type);
		if (activity.step === '') return resource;
		return `${resource} - ${activity.step}`;
	},

	sourceEnvironmentKey(this: void, activity: Activity): string {
		const trimmedSource = activity.sourceEnvironmentID?.trim() ?? '';
		if (trimmedSource !== '') return trimmedSource;
		const trimmedEnvironment = activity.environmentID.trim();
		return trimmedEnvironment === '' ? EnvironmentID.localDocker : trimmedEnvironment;
	},

	sortTime(this: void, activity: Activity): number {
		return dateMs(activity.updatedAt ?? activity.endedAt ?? activity.startedAt);
	},

	statusTint(this: void, activity: Activity): ActivityTint {
		return activityStatusTint(activity.status);
	},

	typeIcon(this: void, activity: Activity): string {
		const raw = activity.type;
		if (raw.startsWith('project_')) return 'folder.fill';
		if (raw.startsWith('image_')) return 'square.3.layers.3d.top.filled';
		if (raw.startsWith('container_')) return 'cube.box.fill';
		if (raw === 'vulnerability_scan') return 'shield.lefthalf.filled';
		if (raw === 'system_prune') return 'trash.circle.fill';
		if (raw === 'auto_update') return 'arrow.triangle.2.circlepath';
		return 'clock.arrow.circlepath';
	},

	typeDisplayName(this: void, activity: Activity): string {
		return activityDisplayName(activity.type);
	}
} as const;

export function messageLevelIcon(level: ActivityMessageLevel): string {
	switch (level) {
		case 'error':
			return 'xmark.octagon.fill';
		case 'warning':
			return 'exclamationmark.triangle.fill';
		case 'success':
			return 'checkmark.circle.fill';
		default:
			return 'info.circle.fill';
	}
}

export function messageLevelTint(level: ActivityMessageLevel): ActivityTint {
	switch (level) {
		case 'error':
			return systemColors.red;
		case 'warning':
			return systemColors.orange;
		case 'success':
			return systemColors.green;
		default:
			return 'secondary';
	}
}

export function startedByLabel(startedBy: ActivityStartedBy): string {
	const trimmed = startedBy.displayName?.trim() ?? '';
	return trimmed === '' ? startedBy.username : trimmed;
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

export function formatDuration(durationMs: number): string {
	const seconds = Math.max(0, Math.trunc(durationMs / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.trunc(seconds / 60);
	const remainder = seconds % 60;
	if (minutes < 60) return `${minutes}m ${remainder}s`;
	const hours = Math.trunc(minutes / 60);
	return `${hours}h ${minutes % 60}m`;
}

export type ActivityBatchSummary = {
	id: string;
	activities: Activity[];
};

export type ActivityCenterItem =
	| { kind: 'activity'; activity: Activity }
	| { kind: 'batch'; batch: ActivityBatchSummary };

export function activityItemKey(activity: Activity): string {
	return `activity-${ActivityDisplay.sourceEnvironmentKey(activity)}-${activity.id}`;
}

export const ActivityCenterItem = {
	id(this: void, item: ActivityCenterItem): string {
		return item.kind === 'activity' ? activityItemKey(item.activity) : `batch-${item.batch.id}`;
	},
	isActive(this: void, item: ActivityCenterItem): boolean {
		return item.kind === 'activity'
			? ActivityDisplay.isCancellable(item.activity)
			: ActivityBatch.isActive(item.batch);
	},
	sortTime(this: void, item: ActivityCenterItem): number {
		return item.kind === 'activity'
			? ActivityDisplay.sortTime(item.activity)
			: ActivityBatch.sortTime(item.batch);
	}
} as const;

export const ActivityBatch = {
	status(batch: ActivityBatchSummary): ActivityStatus {
		if (batch.activities.some(ActivityDisplay.isCancellable)) return 'running';
		if (batch.activities.some((activity) => activity.status === 'failed')) return 'failed';
		if (batch.activities.every((activity) => activity.status === 'cancelled')) return 'cancelled';
		return 'success';
	},
	isActive(batch: ActivityBatchSummary): boolean {
		return batch.activities.some(ActivityDisplay.isCancellable);
	},
	completedCount(batch: ActivityBatchSummary): number {
		return batch.activities.filter((activity) => !ActivityDisplay.isCancellable(activity)).length;
	},
	failedCount(batch: ActivityBatchSummary): number {
		return batch.activities.filter((activity) => activity.status === 'failed').length;
	},
	progress(batch: ActivityBatchSummary): number | undefined {
		if (batch.activities.length === 0) return undefined;
		const values = batch.activities
			.map(ActivityDisplay.displayProgress)
			.filter((value): value is number => value !== undefined);
		if (values.length !== batch.activities.length) return undefined;
		return Math.trunc(values.reduce((sum, value) => sum + value, 0) / values.length);
	},
	sortTime(batch: ActivityBatchSummary): number {
		return batch.activities.length === 0
			? -Infinity
			: Math.max(...batch.activities.map(ActivityDisplay.sortTime));
	},
	startedAt(batch: ActivityBatchSummary): number {
		return batch.activities.length === 0
			? -Infinity
			: Math.min(...batch.activities.map((activity) => dateMs(activity.startedAt)));
	},
	displayTitle(batch: ActivityBatchSummary): string {
		const types = new Set(batch.activities.map((activity) => activity.type));
		const first = [...types][0];
		if (first !== undefined && types.size === 1) return activityDisplayName(first);
		return 'Related Operations';
	},
	environmentLabel(batch: ActivityBatchSummary): string | undefined {
		const names = new Set(
			batch.activities
				.map((activity) => activity.sourceEnvironmentName?.trim() ?? '')
				.filter((name) => name !== '')
		);
		if (names.size === 1) return [...names][0];
		if (names.size > 1) return `${names.size} environments`;
		return undefined;
	}
} as const;

export function retainingActiveActivities(
	activities: readonly Activity[],
	clearedEnvironmentIDs: ReadonlySet<string>
): Activity[] {
	return activities.filter(
		(activity) =>
			!clearedEnvironmentIDs.has(ActivityDisplay.sourceEnvironmentKey(activity)) ||
			activity.status === 'queued' ||
			activity.status === 'running'
	);
}
