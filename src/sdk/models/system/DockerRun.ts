/** Port of Models/System/DockerRun.swift. */

/** Parsed representation of a `docker run` command. */
export interface DockerRunCommand {
	image: string;
	name?: string;
	ports?: string[];
	volumes?: string[];
	environment?: string[];
	networks?: string[];
	restart?: string;
	workdir?: string;
	user?: string;
	entrypoint?: string;
	command?: string;
	detached?: boolean;
	interactive?: boolean;
	tty?: boolean;
	remove?: boolean;
	privileged?: boolean;
	labels?: string[];
	healthCheck?: string;
	memoryLimit?: string;
	cpuLimit?: string;
}

/** Body for `POST /environments/{id}/system/convert`. */
export interface ConvertDockerRunRequest {
	dockerRunCommand: string;
}

/** Result of converting a `docker run` command to compose form. */
export interface ConvertDockerRunResponse {
	success: boolean;
	dockerCompose: string;
	envVars: string;
	serviceName: string;
}
