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
