import type { Activity } from '@/sdk/models/activity/Activity';

export type ActivityToastScope = 'userInitiated' | 'all';

export const ActivityToastScope = {
	preferenceKey: 'arcane.activityToastScope',
	defaultValue: 'userInitiated' as ActivityToastScope,
	allCases: ['userInitiated', 'all'] as const satisfies readonly ActivityToastScope[],

	from(rawValue: string): ActivityToastScope {
		return rawValue === 'all'
			? 'all'
			: rawValue === 'userInitiated'
				? 'userInitiated'
				: ActivityToastScope.defaultValue;
	},

	title(scope: ActivityToastScope): string {
		return scope === 'userInitiated' ? 'User Initiated' : 'All Activities';
	},

	subtitle(scope: ActivityToastScope): string {
		return scope === 'userInitiated'
			? 'Only work started by a user'
			: 'User, automated, and system work';
	},

	includes(scope: ActivityToastScope, activity: Activity): boolean {
		if (scope !== 'userInitiated') return true;
		const startedBy = activity.startedBy;
		if (!startedBy) return false;
		if ((startedBy.userId?.trim() ?? '') !== '') return true;
		const username = startedBy.username.trim();
		return (
			username !== '' &&
			username.localeCompare('System', undefined, { sensitivity: 'accent' }) !== 0
		);
	}
} as const;
