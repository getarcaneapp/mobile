/** Port of Models/JobSchedule/JobSchedule.swift. */
import type { ISODateString } from '../base/date';

/** JobScheduleConfig represents the configured intervals (in minutes) for background jobs. */
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

/** UpdateJobScheduleConfig updates job schedule intervals (in minutes). Undefined fields are ignored. */
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

/** Status and metadata for a background job. */
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
}

export const JobStatus = {
	/** Swift init defaults (`prerequisites` defaults to `[]`). */
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
