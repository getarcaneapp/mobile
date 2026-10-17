import { formattedISO8601 } from '@/core/date-formatting';
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import type { ContainerMount, ContainerPort } from '@/sdk/models/container/Container';
import type { ContainerDetails } from '@/sdk/models/container/ContainerDetails';

import { capitalized } from './container-model';

export function sortedPorts(ports: readonly ContainerPort[]): ContainerPort[] {
	return [...ports].sort((a, b) =>
		a.privatePort !== b.privatePort
			? a.privatePort - b.privatePort
			: a.type < b.type
				? -1
				: a.type > b.type
					? 1
					: 0
	);
}

export function healthPresentation(status: string) {
	const trimmed = status.trim();
	const displayStatus = trimmed === '' ? 'Unknown' : capitalized(trimmed);
	const lower = displayStatus.toLowerCase();
	return {
		displayStatus,
		symbol: lower === 'unhealthy' ? 'heart.slash.fill' : 'heart.fill',
		color:
			lower === 'healthy'
				? 'green'
				: lower === 'unhealthy'
					? 'red'
					: lower === 'starting'
						? 'orange'
						: 'secondary'
	} as const;
}

export const formattedDetailDate = (value: string) =>
	formattedISO8601(value, 'abbreviated', 'shortened');
export const formattedHealthDate = (value: string) =>
	formattedISO8601(value, 'abbreviated', 'standard');

export type ConfigRow =
	| { kind: 'label'; title: string; value: string }
	| { kind: 'monospaced'; title: string; value: string }
	| { kind: 'link'; title: string; systemImage: string; page: 'env' | 'labels' };

export function configRows(details: ContainerDetails): ConfigRow[] {
	const rows: ConfigRow[] = [];
	const config = details.config;
	if (details.image !== '') rows.push({ kind: 'monospaced', title: 'Image', value: details.image });
	if (config.cmd && config.cmd.length > 0)
		rows.push({ kind: 'monospaced', title: 'Command', value: config.cmd.join(' ') });
	if (config.workingDir)
		rows.push({ kind: 'monospaced', title: 'Working Dir', value: config.workingDir });
	if (config.user) rows.push({ kind: 'label', title: 'User', value: config.user });
	if (config.env && config.env.length > 0) {
		rows.push({
			kind: 'link',
			title: `Environment (${config.env.length})`,
			systemImage: 'list.bullet.rectangle',
			page: 'env'
		});
	}
	const labelCount = Object.keys(details.labels ?? {}).length;
	if (labelCount > 0)
		rows.push({
			kind: 'link',
			title: `Labels (${labelCount})`,
			systemImage: 'tag',
			page: 'labels'
		});
	return rows;
}

export function hostConfigRows(details: ContainerDetails) {
	const host = details.hostConfig;
	const rows: { title: string; value: string; monospacedDigit?: boolean }[] = [];
	if (host.networkMode !== undefined) rows.push({ title: 'Network Mode', value: host.networkMode });
	if (host.restartPolicy !== undefined)
		rows.push({ title: 'Restart Policy', value: host.restartPolicy });
	if ((host.memory ?? 0) > 0)
		rows.push({
			title: 'Memory Limit',
			value: formatFileBytes(host.memory ?? 0),
			monospacedDigit: true
		});
	if (host.privileged === true) rows.push({ title: 'Privileged', value: 'Yes' });
	return {
		rows,
		mounts: details.mounts,
		isEmpty: rows.length === 0 && details.mounts.length === 0
	};
}

export function runtimeRows(details: ContainerDetails, isRunning: boolean) {
	const state = details.state;
	const rows: { title: string; value: string; monospacedDigit?: boolean }[] = [
		{ title: 'Status', value: capitalized(state.status) }
	];
	if (state.startedAt !== undefined)
		rows.push({ title: 'Started', value: formattedDetailDate(state.startedAt) });
	if (!isRunning && state.finishedAt !== undefined)
		rows.push({ title: 'Finished', value: formattedDetailDate(state.finishedAt) });
	if (state.exitCode !== undefined && !isRunning)
		rows.push({ title: 'Exit Code', value: String(state.exitCode), monospacedDigit: true });
	return rows;
}

export function networkRows(details: ContainerDetails) {
	return Object.keys(details.networkSettings.networks)
		.sort()
		.map((name) => {
			const endpoint = details.networkSettings.networks[name]!;
			return { name, ip: endpoint.ipAddress || undefined, mac: endpoint.macAddress || undefined };
		});
}

export function mountRows(mount: ContainerMount) {
	const rows: { title: string; value: string; monospaced?: boolean }[] = [
		{ title: 'Type', value: mount.type }
	];
	if (mount.name) rows.push({ title: 'Name', value: mount.name });
	if (mount.source) rows.push({ title: 'Source', value: mount.source, monospaced: true });
	rows.push({ title: 'Destination', value: mount.destination, monospaced: true });
	if (mount.rw !== undefined)
		rows.push({ title: 'Access', value: mount.rw ? 'Read and write' : 'Read only' });
	if (mount.mode) rows.push({ title: 'Mode', value: mount.mode });
	if (mount.driver) rows.push({ title: 'Driver', value: mount.driver });
	if (mount.propagation) rows.push({ title: 'Propagation', value: mount.propagation });
	return rows;
}
