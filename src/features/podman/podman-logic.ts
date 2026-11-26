import type { PodAction } from '@/sdk/models/podman/Pod';
import type { QuadletAction } from '@/sdk/models/podman/Quadlet';
import { Permission } from '@/sdk/models/role/Permission';

export type PodmanStateVariant = 'running' | 'stopped' | 'starting' | 'paused' | 'unknown';

export function podmanStateVariant(state: string | undefined): PodmanStateVariant {
	const normalized = (state ?? '').trim().toLowerCase();
	if (normalized === 'running' || normalized === 'active') return 'running';
	if (normalized === 'paused') return 'paused';
	if (['exited', 'stopped', 'dead', 'failed', 'error', 'inactive'].includes(normalized))
		return 'stopped';
	if (!normalized || normalized === 'unknown' || normalized.startsWith('not loaded'))
		return 'unknown';
	return 'starting';
}

export function podmanBadgeStatus(state: string | undefined): string {
	const normalized = (state ?? '').trim().toLowerCase();
	if (normalized === 'failed' || normalized === 'error') return 'failed';
	const variant = podmanStateVariant(state);
	return variant === 'unknown' ? normalized : variant;
}

export function podmanStateLabel(state: string | undefined): string {
	const trimmed = (state ?? '').trim();
	if (trimmed === '') return 'Unknown';
	return trimmed
		.replace(/[_-]/g, ' ')
		.toLowerCase()
		.replace(/(^|\s)(\S)/g, (_m, space: string, c: string) => space + c.toUpperCase());
}

export type PodmanActionInfo<Action extends string> = {
	action: Action;
	title: string;
	systemImage: string;
	permission: string;
	destructive?: boolean;
	confirmationMessage?: string;
};

export const podActionInfo: Record<PodAction, PodmanActionInfo<PodAction>> = {
	start: {
		action: 'start',
		title: 'Start',
		systemImage: 'play.fill',
		permission: Permission.Podman.podsStart
	},
	stop: {
		action: 'stop',
		title: 'Stop',
		systemImage: 'stop.fill',
		permission: Permission.Podman.podsStop
	},
	restart: {
		action: 'restart',
		title: 'Restart',
		systemImage: 'arrow.clockwise',
		permission: Permission.Podman.podsRestart
	},
	pause: {
		action: 'pause',
		title: 'Pause',
		systemImage: 'pause.fill',
		permission: Permission.Podman.podsPause
	},
	unpause: {
		action: 'unpause',
		title: 'Resume',
		systemImage: 'play.circle',
		permission: Permission.Podman.podsPause
	},
	kill: {
		action: 'kill',
		title: 'Kill',
		systemImage: 'bolt.fill',
		permission: Permission.Podman.podsKill,
		destructive: true,
		confirmationMessage: 'Every container in the pod is sent SIGKILL.'
	}
};

export function podActions(state: string | undefined): PodAction[] {
	switch (podmanStateVariant(state)) {
		case 'running':
			return ['restart', 'stop', 'pause', 'kill'];
		case 'paused':
			return ['unpause', 'stop', 'kill'];
		case 'stopped':
			return ['start'];
		default:
			return ['start', 'restart', 'stop', 'kill'];
	}
}

export const quadletActionInfo: Record<QuadletAction, PodmanActionInfo<QuadletAction>> = {
	start: {
		action: 'start',
		title: 'Start',
		systemImage: 'play.fill',
		permission: Permission.Podman.quadletsStart
	},
	stop: {
		action: 'stop',
		title: 'Stop',
		systemImage: 'stop.fill',
		permission: Permission.Podman.quadletsStop
	},
	restart: {
		action: 'restart',
		title: 'Restart',
		systemImage: 'arrow.clockwise',
		permission: Permission.Podman.quadletsRestart
	}
};

export function quadletActions(state: string | undefined): QuadletAction[] {
	switch (podmanStateVariant(state)) {
		case 'running':
			return ['restart', 'stop'];
		case 'stopped':
			return ['start'];
		default:
			return ['start', 'restart', 'stop'];
	}
}

export function isRunningPod(state: string | undefined): boolean {
	const variant = podmanStateVariant(state);
	return variant === 'running' || variant === 'paused' || variant === 'starting';
}

export function quadletFileNameError(name: string): string | undefined {
	const trimmed = name.trim();
	if (trimmed === '') return undefined;
	if (trimmed.includes('/')) return 'Use a file name, not a path.';
	if (!/\.(container|pod|kube|network|volume|image|build|artifact)$/i.test(trimmed))
		return 'End the name with .container, .pod, .kube, .network, .volume, .image, .build or .artifact.';
	return undefined;
}

export function autoUpdateUpdatedLabel(updated: string): string {
	switch (updated.trim().toLowerCase()) {
		case 'true':
			return 'Updated';
		case 'false':
			return 'Up to date';
		case 'pending':
			return 'Update available';
		case 'failed':
			return 'Failed';
		case 'rolled back':
			return 'Rolled back';
		default:
			return podmanStateLabel(updated);
	}
}

export function autoUpdateUpdatedStatus(updated: string): string {
	switch (updated.trim().toLowerCase()) {
		case 'true':
		case 'false':
			return 'success';
		case 'pending':
		case 'rolled back':
			return 'starting';
		case 'failed':
			return 'failed';
		default:
			return '';
	}
}

export function memoryLimitLabel(bytes: number | undefined): string | undefined {
	if (bytes === undefined || bytes <= 0) return undefined;
	const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[unit]}`;
}
