import type { JSONValue } from '../../types/json';
import type { ContainerRegistryCredential } from '../containerRegistry/ContainerRegistry';
import type { ContainerHealthcheckCreate, ContainerMountCreate } from './ContainerEditing';

export interface ContainerRestartPolicyCreate {
	name?: string;
	maximumRetryCount?: number;
}

export interface PortBindingCreate {
	hostIp?: string;
	hostPort?: string;
}

export interface HostConfigCreate {
	binds?: string[];
	portBindings?: Record<string, PortBindingCreate[]>;
	restartPolicy?: ContainerRestartPolicyCreate;
	networkMode?: string;
	privileged?: boolean;
	autoRemove?: boolean;
	memory?: number;
	memorySwap?: number;
	nanoCpus?: number;
	cpuShares?: number;
	readonlyRootfs?: boolean;
	publishAllPorts?: boolean;
	capAdd?: string[];
	capDrop?: string[];
	mounts?: ContainerMountCreate[];
}

export interface EndpointSettingsCreate {
	aliases?: string[];
	ipv4Address?: string;
	ipv6Address?: string;
}

export interface NetworkingConfigCreate {
	endpointsConfig?: Record<string, EndpointSettingsCreate>;
}

export interface ContainerCreate {
	name: string;
	image: string;
	command?: string[];
	cmd?: string[];
	entrypoint?: string[];
	workingDir?: string;
	user?: string;
	environment?: string[];
	env?: string[];
	labels?: Record<string, string>;
	healthcheck?: ContainerHealthcheckCreate;
	exposedPorts?: Record<string, JSONValue>;
	hostConfig?: HostConfigCreate;
	networkingConfig?: NetworkingConfigCreate;
	hostname?: string;
	domainname?: string;
	attachStdout?: boolean;
	attachStderr?: boolean;
	attachStdin?: boolean;
	tty?: boolean;
	openStdin?: boolean;
	stdinOnce?: boolean;
	networkDisabled?: boolean;
	ports?: Record<string, string>;
	volumes?: string[];
	networks?: string[];
	restartPolicy?: string;
	privileged?: boolean;
	autoRemove?: boolean;
	memory?: number;
	cpus?: number;
	credentials?: ContainerRegistryCredential[];
}
