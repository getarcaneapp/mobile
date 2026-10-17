import type { ContainerRegistryCredential } from '../containerRegistry/ContainerRegistry';
import type {
	ContainerRestartPolicyCreate,
	EndpointSettingsCreate,
	HostConfigCreate,
	NetworkingConfigCreate,
	PortBindingCreate
} from './ContainerCreate';

export interface ContainerMountCreate {
	type: string;
	source: string;
	target: string;
	readOnly?: boolean;
}

export interface ContainerHealthcheckCreate {
	test?: string[];
	interval?: number;
	timeout?: number;
	startPeriod?: number;
	startInterval?: number;
	retries?: number;
}

export interface HostConfigEdit {
	binds?: string[];
	mounts?: ContainerMountCreate[];
	portBindings?: Record<string, PortBindingCreate[]>;
	restartPolicy?: ContainerRestartPolicyCreate;
	privileged?: boolean;
	capAdd?: string[];
	capDrop?: string[];
	autoRemove?: boolean;
	readonlyRootfs?: boolean;
	memory?: number;
	memorySwap?: number;
	nanoCpus?: number;
	cpuShares?: number;
}

export interface ContainerEdit {
	name?: string;
	image?: string;
	workingDir?: string;
	user?: string;
	command?: string[];
	entrypoint?: string[];
	environment?: string[];
	labels?: Record<string, string>;
	healthcheck?: ContainerHealthcheckCreate;
	clearHealthcheck?: boolean;
	hostConfig?: HostConfigEdit;
	networkingConfig?: NetworkingConfigCreate;
	credentials?: ContainerRegistryCredential[];
}

export interface ContainerEditConfig {
	id: string;
	name: string;
	image: string;
	hostConfig: HostConfigCreate;
	running: boolean;
	command?: string[];
	entrypoint?: string[];
	workingDir?: string;
	user?: string;
	environment?: string[];
	labels?: Record<string, string>;
	healthcheck?: ContainerHealthcheckCreate;
	networks?: Record<string, EndpointSettingsCreate>;
	isCompose?: boolean;
	composeProject?: string;
	editDisabled?: boolean;
}

export interface ContainerCommitRequest {
	repository?: string;
	tag?: string;
	comment?: string;
	author?: string;
	changes?: string[];
	noPause?: boolean;
}

export interface ContainerCommitResult {
	id: string;
}

export interface ContainerGenerateComposeRequest {
	containerIds: string[];
}

export interface ContainerGenerateComposeResponse {
	composeContent: string;
}
