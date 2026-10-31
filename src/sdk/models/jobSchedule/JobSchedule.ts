import type { ISODateString } from '../base/date';

export interface JobScheduleConfig {
	environmentHealthInterval: string;
	eventCleanupInterval: string;
	expiredSessionsCleanupInterval: string;
	autoUpdateInterval: string;
	dockerClientRefreshInterval: string;
	pollingInterval: string;
	scheduledPruneInterval: string;
	gitopsSyncInterval: string;
	vulnerabilityScanInterval: string;
	autoHealInterval: string;
}

export interface UpdateJobScheduleConfig {
	environmentHealthInterval?: string;
	eventCleanupInterval?: string;
	expiredSessionsCleanupInterval?: string;
	autoUpdateInterval?: string;
	dockerClientRefreshInterval?: string;
	pollingInterval?: string;
	scheduledPruneInterval?: string;
	gitopsSyncInterval?: string;
	vulnerabilityScanInterval?: string;
	autoHealInterval?: string;
}

export interface JobStatus {
	id: string;
	name: string;
	description: string;
	category: string;
	schedule: string;
	nextRun?: ISODateString;
	enabled: boolean;
	managerOnly: boolean;
	isContinuous: boolean;
	canRunManually: boolean;
	prerequisites: JobPrerequisite[];
	settingsKey?: string;
	lastRun?: JobRunSummary;
	lastError?: string;
	children?: JobStatus[];
}

export type JobRunStatus =
	| 'queued'
	| 'waiting'
	| 'running'
	| 'retrying'
	| 'succeeded'
	| 'partial'
	| 'skipped'
	| 'failed'
	| 'needs_attention'
	| 'canceled'
	| (string & {});

export interface JobRunSummary {
	id: string;
	status: JobRunStatus;
	updatedAt?: ISODateString;
	finishedAt?: ISODateString;
	activityId?: string;
	outcome?: {
		status?: JobRunStatus;
		message?: string;
		activityId?: string;
		targets?: { id: string; activityId?: string }[];
	};
}

export const JobStatus = {
	make(init: Omit<JobStatus, 'prerequisites'> & { prerequisites?: JobPrerequisite[] }): JobStatus {
		return { ...init, prerequisites: init.prerequisites ?? [] };
	}
} as const;

export interface JobPrerequisite {
	settingKey: string;
	label: string;
	isMet: boolean;
	settingsUrl?: string;
}

export interface JobListResponse {
	jobs: JobStatus[];
	isAgent: boolean;
}

export interface JobRunResponse {
	success: boolean;
	message: string;
}
