/** Port of Models/Container/ContainerEditing.swift. */
import type { ContainerRegistryCredential } from '../containerRegistry/ContainerRegistry';
import type {
	ContainerRestartPolicyCreate,
	EndpointSettingsCreate,
	HostConfigCreate,
	NetworkingConfigCreate,
	PortBindingCreate
} from './ContainerCreate';

/** Typed bind or volume mount. */
export interface ContainerMountCreate {
	type: string;
	source: string;
	target: string;
	readOnly?: boolean;
}

/** Healthcheck for create/edit. All durations are in seconds, unlike inspect durations. */
export interface ContainerHealthcheckCreate {
	test?: string[];
	interval?: number;
	timeout?: number;
	startPeriod?: number;
	startInterval?: number;
	retries?: number;
}

/** Host edits: undefined preserves a field; empty collections, zero, and false replace it. */
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

/** Configuration changes applied by recreating a container. Undefined fields are omitted and preserved. */
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

/** Editable snapshot. Omitted boolean flags from the server have false semantics. */
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

/** Options for creating an image from a container filesystem. */
export interface ContainerCommitRequest {
	repository?: string;
	tag?: string;
	comment?: string;
	author?: string;
	changes?: string[];
	noPause?: boolean;
}

/** Committed image identifier. */
export interface ContainerCommitResult {
	id: string;
}

/** Containers to convert to a Compose document. */
export interface ContainerGenerateComposeRequest {
	containerIds: string[];
}

/** Generated Compose document. */
export interface ContainerGenerateComposeResponse {
	composeContent: string;
}
