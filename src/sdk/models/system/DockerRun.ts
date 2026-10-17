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

export interface ConvertDockerRunRequest {
	dockerRunCommand: string;
}

export interface ConvertDockerRunResponse {
	success: boolean;
	dockerCompose: string;
	envVars: string;
	serviceName: string;
}
