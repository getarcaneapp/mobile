import { deepEqual } from '@/core/deep-equal';
import type {
	ContainerCreate,
	EndpointSettingsCreate,
	HostConfigCreate,
	PortBindingCreate
} from '@/sdk/models/container/ContainerCreate';
import type {
	ContainerEdit,
	ContainerEditConfig,
	ContainerHealthcheckCreate,
	HostConfigEdit
} from '@/sdk/models/container/ContainerEditing';

let nextDraftID = 0;
const draftID = () => `draft-${Date.now().toString(36)}-${nextDraftID++}`;

export interface ContainerPortDraft {
	id: string;
	port: string;
	hostIP: string;
	hostPort: string;
}

export interface ContainerMountDraft {
	id: string;
	type: string;
	source: string;
	target: string;
	readOnly: boolean;
}

export interface ContainerNetworkDraft {
	id: string;
	name: string;
	aliases: string;
	ipv4: string;
	ipv6: string;
}

export const newPortDraft = (init: Partial<ContainerPortDraft> = {}): ContainerPortDraft => ({
	id: draftID(),
	port: '80/tcp',
	hostIP: '',
	hostPort: '',
	...init
});

export const newMountDraft = (init: Partial<ContainerMountDraft> = {}): ContainerMountDraft => ({
	id: draftID(),
	type: 'volume',
	source: '',
	target: '',
	readOnly: false,
	...init
});

export const newNetworkDraft = (
	init: Partial<ContainerNetworkDraft> = {}
): ContainerNetworkDraft => ({
	id: draftID(),
	name: '',
	aliases: '',
	ipv4: '',
	ipv6: '',
	...init
});

export interface ContainerConfigurationDraft {
	sourceConfig?: ContainerEditConfig;
	name: string;
	image: string;
	command: string;
	entrypoint: string;
	workingDir: string;
	user: string;
	environment: string;
	labels: string;
	binds: string;
	ports: ContainerPortDraft[];
	mounts: ContainerMountDraft[];
	networks: ContainerNetworkDraft[];
	restartPolicy: string;
	retryCount: string;
	privileged: boolean;
	autoRemove: boolean;
	readOnly: boolean;
	capAdd: string;
	capDrop: string;
	memory: string;
	memorySwap: string;
	nanoCPUs: string;
	cpuShares: string;
	healthMode: 'inherit' | 'disabled' | 'custom';
	healthCommand: string;
	interval: string;
	timeout: string;
	startPeriod: string;
	startInterval: string;
	retries: string;
}

export class DraftError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DraftError';
	}
}

export function emptyDraft(): ContainerConfigurationDraft {
	return {
		name: '',
		image: '',
		command: '',
		entrypoint: '',
		workingDir: '',
		user: '',
		environment: '',
		labels: '',
		binds: '',
		ports: [],
		mounts: [],
		networks: [],
		restartPolicy: 'no',
		retryCount: '0',
		privileged: false,
		autoRemove: false,
		readOnly: false,
		capAdd: '',
		capDrop: '',
		memory: '0',
		memorySwap: '0',
		nanoCPUs: '0',
		cpuShares: '0',
		healthMode: 'inherit',
		healthCommand: '',
		interval: '0',
		timeout: '0',
		startPeriod: '0',
		startInterval: '0',
		retries: '0'
	};
}

const byKey = <V>(record: Record<string, V>) =>
	Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const labelText = (labels: Record<string, string>) =>
	byKey(labels)
		.map(([key, value]) => `${key}=${value}`)
		.join('\n');

export function draftFromConfig(config: ContainerEditConfig): ContainerConfigurationDraft {
	const host = config.hostConfig;
	const health = config.healthcheck;
	return {
		...emptyDraft(),
		sourceConfig: config,
		name: config.name,
		image: config.image,
		command: (config.command ?? []).join('\n'),
		entrypoint: (config.entrypoint ?? []).join('\n'),
		workingDir: config.workingDir ?? '',
		user: config.user ?? '',
		environment: (config.environment ?? []).join('\n'),
		labels: labelText(config.labels ?? {}),
		binds: (host.binds ?? []).join('\n'),
		ports: byKey(host.portBindings ?? {}).flatMap(([key, values]) =>
			values.map((value) =>
				newPortDraft({ port: key, hostIP: value.hostIp ?? '', hostPort: value.hostPort ?? '' })
			)
		),
		mounts: (host.mounts ?? []).map((mount) =>
			newMountDraft({
				type: mount.type,
				source: mount.source,
				target: mount.target,
				readOnly: mount.readOnly ?? false
			})
		),
		networks: byKey(config.networks ?? {}).map(([key, value]) =>
			newNetworkDraft({
				name: key,
				aliases: (value.aliases ?? []).join('\n'),
				ipv4: value.ipv4Address ?? '',
				ipv6: value.ipv6Address ?? ''
			})
		),
		restartPolicy: host.restartPolicy?.name ?? 'no',
		retryCount: String(host.restartPolicy?.maximumRetryCount ?? 0),
		privileged: host.privileged ?? false,
		autoRemove: host.autoRemove ?? false,
		readOnly: host.readonlyRootfs ?? false,
		capAdd: (host.capAdd ?? []).join('\n'),
		capDrop: (host.capDrop ?? []).join('\n'),
		memory: String(host.memory ?? 0),
		memorySwap: String(host.memorySwap ?? 0),
		nanoCPUs: String(host.nanoCpus ?? 0),
		cpuShares: String(host.cpuShares ?? 0),
		...(health
			? {
					healthMode:
						health.test?.length === 1 && health.test[0] === 'NONE' ? 'disabled' : 'custom',
					healthCommand: (health.test ?? []).join('\n'),
					interval: String(health.interval ?? 0),
					timeout: String(health.timeout ?? 0),
					startPeriod: String(health.startPeriod ?? 0),
					startInterval: String(health.startInterval ?? 0),
					retries: String(health.retries ?? 0)
				}
			: {})
	};
}

export function lines(value: string): string[] {
	// oxlint-disable-next-line no-control-regex -- VT/FF are part of Swift CharacterSet.newlines.
	return value.split(/\r\n|[\n\r\u000B\u000C\u0085\u2028\u2029]/).filter((line) => line !== '');
}

function preservedLines(value: string, original: string[] | undefined): string[] {
	if (original && original.join('\n') === value) return original;
	return lines(value);
}

function integer(value: string, label: string, allowMinusOne = false): number {
	const number = /^[+-]?\d+$/.test(value) ? Number(value) : NaN;
	if (!Number.isSafeInteger(number) || number < (allowMinusOne ? -1 : 0)) {
		throw new DraftError(
			`${label} must be a whole number ${allowMinusOne ? 'of -1 or greater' : 'of zero or greater'}.`
		);
	}
	return number;
}

const isWholeNumber = (value: string) => /^[+-]?\d+$/.test(value);

export const draftsEqual = (a: ContainerConfigurationDraft, b: ContainerConfigurationDraft) =>
	deepEqual(a, b);

export function createRequest(draft: ContainerConfigurationDraft): ContainerCreate {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(draft.name)) {
		throw new DraftError(
			'Enter a container name using letters, digits, dots, underscores, or hyphens.'
		);
	}
	if (draft.image.trim() === '') throw new DraftError('Enter an image reference.');

	const source = draft.sourceConfig;
	const originalLabels = source?.labels ?? {};
	const labelsUnchanged = source !== undefined && draft.labels === labelText(originalLabels);
	const labelMap: Record<string, string> = labelsUnchanged ? { ...originalLabels } : {};
	for (const line of labelsUnchanged ? [] : lines(draft.labels)) {
		const separator = line.indexOf('=');
		if (separator <= 0) throw new DraftError('Enter each label as name=value.');
		const key = line.slice(0, separator);
		if (key in labelMap) throw new DraftError('Label names must be unique.');
		labelMap[key] = line.slice(separator + 1);
	}

	const portMap: Record<string, PortBindingCreate[]> = {};
	for (const port of draft.ports) {
		const components = port.port.split('/').filter((part) => part !== '');
		const number =
			components[0] !== undefined && isWholeNumber(components[0]) ? Number(components[0]) : NaN;
		if (
			components.length !== 2 ||
			!(number >= 1 && number <= 65535) ||
			!['tcp', 'udp', 'sctp'].includes(components[1] ?? '')
		) {
			throw new DraftError('Use a container port such as 80/tcp or 53/udp.');
		}
		if (port.hostPort !== '') {
			const host = isWholeNumber(port.hostPort) ? Number(port.hostPort) : NaN;
			if (!(host >= 1 && host <= 65535)) {
				throw new DraftError(
					'Host ports must be between 1 and 65535, or blank for automatic assignment.'
				);
			}
		}
		(portMap[port.port] ??= []).push({ hostIp: port.hostIP, hostPort: port.hostPort });
	}

	for (const mount of draft.mounts) {
		if (mount.source === '' || !mount.target.startsWith('/')) {
			throw new DraftError('Mounts need a source and an absolute container path.');
		}
	}

	const endpoints: Record<string, EndpointSettingsCreate> = {};
	for (const network of draft.networks) {
		if (network.name === '' || network.name in endpoints) {
			throw new DraftError('Network names must be nonempty and unique.');
		}
		endpoints[network.name] = {
			aliases: lines(network.aliases),
			ipv4Address: network.ipv4,
			ipv6Address: network.ipv6
		};
	}

	let health: ContainerHealthcheckCreate | undefined;
	switch (draft.healthMode) {
		case 'disabled':
			health = { test: ['NONE'] };
			break;
		case 'custom': {
			const test = lines(draft.healthCommand);
			const kind = test[0];
			if (kind === undefined || !['CMD', 'CMD-SHELL'].includes(kind) || test.length <= 1) {
				throw new DraftError(
					'Start the health command with CMD or CMD-SHELL on its own line, followed by its arguments.'
				);
			}
			health = {
				test,
				interval: integer(draft.interval, 'Interval'),
				timeout: integer(draft.timeout, 'Timeout'),
				startPeriod: integer(draft.startPeriod, 'Start period'),
				startInterval: integer(draft.startInterval, 'Start interval'),
				retries: integer(draft.retries, 'Retries')
			};
			break;
		}
		default:
			health = undefined;
	}

	const hostConfig: HostConfigCreate = {
		binds: lines(draft.binds),
		portBindings: portMap,
		restartPolicy: {
			name: draft.restartPolicy,
			maximumRetryCount: integer(draft.retryCount, 'Retry count')
		},
		privileged: draft.privileged,
		autoRemove: draft.autoRemove,
		memory: integer(draft.memory, 'Memory'),
		memorySwap: integer(draft.memorySwap, 'Memory and swap', true),
		nanoCpus: integer(draft.nanoCPUs, 'CPU allocation'),
		cpuShares: integer(draft.cpuShares, 'CPU shares'),
		readonlyRootfs: draft.readOnly,
		capAdd: lines(draft.capAdd),
		capDrop: lines(draft.capDrop),
		mounts: draft.mounts.map((mount) => ({
			type: mount.type,
			source: mount.source,
			target: mount.target,
			readOnly: mount.readOnly
		}))
	};

	return {
		name: draft.name,
		image: draft.image,
		command: preservedLines(draft.command, source?.command),
		entrypoint: preservedLines(draft.entrypoint, source?.entrypoint),
		workingDir: draft.workingDir,
		user: draft.user,
		environment: preservedLines(draft.environment, source?.environment),
		labels: labelMap,
		healthcheck: health,
		hostConfig,
		networkingConfig: { endpointsConfig: endpoints }
	};
}

export function editRequest(
	draft: ContainerConfigurationDraft,
	original: ContainerConfigurationDraft
): ContainerEdit {
	const desired = createRequest(draft);
	const previous = createRequest(original);
	const host = desired.hostConfig!;
	const oldHost = previous.hostConfig!;
	const edit: ContainerEdit = {};
	const changed = (a: unknown, b: unknown) => !deepEqual(a, b);
	if (desired.name !== previous.name) edit.name = desired.name;
	if (desired.image !== previous.image) edit.image = desired.image;
	if (changed(desired.command, previous.command)) edit.command = desired.command;
	if (changed(desired.entrypoint, previous.entrypoint)) edit.entrypoint = desired.entrypoint;
	if (desired.workingDir !== previous.workingDir) edit.workingDir = desired.workingDir;
	if (desired.user !== previous.user) edit.user = desired.user;
	if (changed(desired.environment, previous.environment)) edit.environment = desired.environment;
	if (changed(desired.labels, previous.labels)) edit.labels = desired.labels;
	if (
		changed(desired.healthcheck, previous.healthcheck) ||
		draft.healthMode !== original.healthMode
	) {
		edit.healthcheck = desired.healthcheck;
		edit.clearHealthcheck = draft.healthMode === 'inherit';
	}
	if (changed(desired.networkingConfig, previous.networkingConfig))
		edit.networkingConfig = desired.networkingConfig;
	if (changed(host, oldHost)) {
		const change: HostConfigEdit = {};
		if (changed(host.binds, oldHost.binds)) change.binds = host.binds;
		if (changed(host.mounts, oldHost.mounts)) change.mounts = host.mounts;
		if (changed(host.portBindings, oldHost.portBindings)) change.portBindings = host.portBindings;
		if (changed(host.restartPolicy, oldHost.restartPolicy))
			change.restartPolicy = host.restartPolicy;
		if (host.privileged !== oldHost.privileged) change.privileged = host.privileged;
		if (host.autoRemove !== oldHost.autoRemove) change.autoRemove = host.autoRemove;
		if (host.readonlyRootfs !== oldHost.readonlyRootfs) change.readonlyRootfs = host.readonlyRootfs;
		if (host.memory !== oldHost.memory) change.memory = host.memory;
		if (host.memorySwap !== oldHost.memorySwap) change.memorySwap = host.memorySwap;
		if (host.nanoCpus !== oldHost.nanoCpus) change.nanoCpus = host.nanoCpus;
		if (host.cpuShares !== oldHost.cpuShares) change.cpuShares = host.cpuShares;
		if (changed(host.capAdd, oldHost.capAdd)) change.capAdd = host.capAdd;
		if (changed(host.capDrop, oldHost.capDrop)) change.capDrop = host.capDrop;
		edit.hostConfig = change;
	}
	return edit;
}
