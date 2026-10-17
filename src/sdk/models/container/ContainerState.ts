/** Port of Models/Container/ContainerState.swift. */

/** A single probe result from the healthcheck log. */
export interface ContainerHealthLogEntry {
	start?: string;
	end?: string;
	exitCode: number;
	output?: string;
}

export const ContainerHealthLogEntry = {
	make(init: Partial<ContainerHealthLogEntry> = {}): ContainerHealthLogEntry {
		return { ...init, exitCode: init.exitCode ?? 0 };
	}
} as const;

/** Current healthcheck state of a container. */
export interface ContainerHealth {
	status: string;
	failingStreak: number;
	log?: ContainerHealthLogEntry[];
}

export const ContainerHealth = {
	make(init: Partial<ContainerHealth> & Pick<ContainerHealth, 'status'>): ContainerHealth {
		return { ...init, failingStreak: init.failingStreak ?? 0 };
	}
} as const;

/** Container healthcheck configuration. Duration values are expressed in nanoseconds. */
export interface ContainerHealthcheck {
	test?: string[];
	interval?: number;
	timeout?: number;
	startPeriod?: number;
	startInterval?: number;
	retries?: number;
}

/** State of a container. */
export interface ContainerState {
	status: string;
	running: boolean;
	exitCode?: number;
	startedAt?: string;
	finishedAt?: string;
	health?: ContainerHealth;
}

/** Configuration details for a container. */
export interface ContainerConfig {
	env?: string[];
	cmd?: string[];
	entrypoint?: string[];
	workingDir?: string;
	user?: string;
	healthcheck?: ContainerHealthcheck;
}

/** Docker Compose project information extracted from container labels. */
export interface ContainerComposeInfo {
	projectName: string;
	serviceName: string;
	workingDir?: string;
	configFiles?: string;
}
