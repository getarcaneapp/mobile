import { formatFileBytes } from '@/core/networking/remote-data-limits';
import type { Environment, EnvironmentVersion } from '@/sdk/models/environment/EnvironmentModel';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import { JSONValue } from '@/sdk/types/json';
import {
	environmentAutomationSections,
	environmentDockerSections,
	environmentFeatureSections,
	environmentSecuritySectionCases,
	environmentSecuritySections,
	environmentStorageSections,
	sectionFields,
	type SettingFieldDef
} from '@/ui/components/settings-form.types';

export type EnvironmentDetailSection =
	| 'Info'
	| 'Connection'
	| 'Features'
	| 'Storage'
	| 'Docker'
	| 'Security'
	| 'Automations'
	| 'GitOps';

export const environmentDetailSectionCases: EnvironmentDetailSection[] = [
	'Info',
	'Connection',
	'Features',
	'Storage',
	'Docker',
	'Security',
	'Automations',
	'GitOps'
];

export const environmentDetailSectionImage: Record<EnvironmentDetailSection, string> = {
	Info: 'info.circle',
	Connection: 'network',
	Features: 'switch.2',
	Storage: 'externaldrive',
	Docker: 'shippingbox.fill',
	Security: 'shield.lefthalf.filled',
	Automations: 'calendar.badge.clock',
	GitOps: 'arrow.triangle.merge'
};

export const isSettingsSection = (section: EnvironmentDetailSection) =>
	section === 'Features' ||
	section === 'Storage' ||
	section === 'Docker' ||
	section === 'Security' ||
	section === 'Automations';

export const allEnvironmentSettingsFields: SettingFieldDef[] = sectionFields([
	...environmentFeatureSections,
	...environmentStorageSections,
	...environmentDockerSections,
	...environmentSecuritySectionCases.flatMap((section) => environmentSecuritySections[section]),
	...environmentAutomationSections
]);

export type EnvironmentDetails = {
	environment: Environment;
	edgeDataPlane?: string;
	edgeRoundTripMs?: number;
	edgeOpenStreams?: number;
};

export function decodeEnvironmentDetails(raw: unknown): EnvironmentDetails {
	const o = (raw ?? {}) as Record<string, unknown>;
	const environment = { ...(o as unknown as Environment) };
	environment.enabled = typeof o.enabled === 'boolean' ? o.enabled : true;
	environment.isEdge = typeof o.isEdge === 'boolean' ? o.isEdge : false;
	return {
		environment,
		edgeDataPlane: typeof o.edgeDataPlane === 'string' ? o.edgeDataPlane : undefined,
		edgeRoundTripMs: typeof o.edgeRoundTripMs === 'number' ? o.edgeRoundTripMs : undefined,
		edgeOpenStreams:
			typeof o.edgeOpenStreams === 'number' ? Math.trunc(o.edgeOpenStreams) : undefined
	};
}

const infoValue = (info: DockerInfo, key: string) => info.info?.[key];
const infoInt = (info: DockerInfo, key: string) => JSONValue.int64Value(infoValue(info, key)) ?? 0;
const infoString = (info: DockerInfo, key: string) =>
	JSONValue.stringValue(infoValue(info, key)) ?? '';
const infoBool = (info: DockerInfo, key: string) =>
	JSONValue.boolValue(infoValue(info, key)) ?? false;

function warnings(info: DockerInfo): string[] | undefined {
	const value = infoValue(info, 'Warnings');
	if (!Array.isArray(value)) return undefined;
	return value.flatMap((item) => {
		const text = JSONValue.stringValue(item);
		return text === undefined ? [] : [text];
	});
}

function runtimeNames(info: DockerInfo): string[] {
	const value = infoValue(info, 'Runtimes');
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
	return Object.keys(value).sort();
}

export type InfoRow = { label: string; value: string };
export type InfoGroup = { title: string; rows: InfoRow[] };

const row = (label: string, value: string | undefined | null): InfoRow => {
	const trimmed = (value ?? '').trim();
	return { label, value: trimmed === '' ? '—' : trimmed };
};
const exact = (label: string, value: string): InfoRow => ({ label, value });

const boolText = (value: boolean | undefined) => (value === undefined ? '—' : value ? 'Yes' : 'No');
const nonEmpty = (value: string | undefined) => (value ? value : '—');
const shortCommit = (commit: string) => (commit === '' ? '—' : commit.slice(0, 8));

export function systemInfoGroups(
	info: DockerInfo,
	version: EnvironmentVersion | undefined
): InfoGroup[] {
	const ncpu = JSONValue.intValue(infoValue(info, 'NCPU'));
	const memTotal = JSONValue.int64Value(infoValue(info, 'MemTotal'));
	const groups: InfoGroup[] = [
		{
			title: 'Host',
			rows: [
				row('Hostname', JSONValue.stringValue(infoValue(info, 'Name'))),
				exact('Daemon ID', infoString(info, 'ID')),
				row('Operating System', JSONValue.stringValue(infoValue(info, 'OperatingSystem'))),
				exact('OS Type', infoString(info, 'OSType')),
				exact('Kernel', infoString(info, 'KernelVersion')),
				exact('Architecture', infoString(info, 'Architecture'))
			]
		},
		{
			title: 'Capacity',
			rows: [
				row('CPUs', ncpu === undefined ? undefined : String(ncpu)),
				row('Memory', memTotal === undefined ? undefined : formatFileBytes(memTotal))
			]
		}
	];
	if (version) {
		const rows: InfoRow[] = [
			exact('Version', version.displayVersion),
			exact('Revision', nonEmpty(version.shortRevision)),
			exact('Go Version', nonEmpty(version.goVersion))
		];
		if (version.buildTime !== undefined)
			rows.push(exact('Build Time', nonEmpty(version.buildTime)));
		rows.push(exact('Update Available', version.updateAvailable ? 'Yes' : 'No'));
		if (version.updateAvailable && version.newestVersion !== undefined)
			rows.push(exact('Newest Version', version.newestVersion));
		groups.push({ title: 'Arcane', rows });
	}
	return groups;
}

export function dockerInfoGroups(info: DockerInfo): InfoGroup[] {
	const runtimes = runtimeNames(info).join(', ');
	const groups: InfoGroup[] = [
		{
			title: 'Engine',
			rows: [
				row('Server Version', JSONValue.stringValue(infoValue(info, 'ServerVersion'))),
				exact('API Version', info.apiVersion),
				exact('Go Version', info.goVersion),
				exact('Git Commit', shortCommit(info.gitCommit)),
				exact('Build Time', nonEmpty(info.buildTime))
			]
		},
		{
			title: 'Counts',
			rows: [
				exact('Containers', String(infoInt(info, 'Containers'))),
				exact('Running', String(infoInt(info, 'ContainersRunning'))),
				exact('Paused', String(infoInt(info, 'ContainersPaused'))),
				exact('Stopped', String(infoInt(info, 'ContainersStopped'))),
				exact('Images', String(infoInt(info, 'Images')))
			]
		},
		{
			title: 'Runtime',
			rows: [
				exact('Storage Driver', infoString(info, 'Driver')),
				exact('Logging Driver', infoString(info, 'LoggingDriver')),
				exact('Cgroup Driver', infoString(info, 'CgroupDriver')),
				exact('Cgroup Version', JSONValue.stringValue(infoValue(info, 'CgroupVersion')) ?? '—'),
				exact('Default Runtime', infoString(info, 'DefaultRuntime')),
				exact('Runtimes', runtimes === '' ? '—' : runtimes),
				exact('Docker Root', infoString(info, 'DockerRootDir'))
			]
		},
		{
			title: 'Features',
			rows: [
				exact('Live Restore', boolText(infoBool(info, 'LiveRestoreEnabled'))),
				exact('Experimental', boolText(infoBool(info, 'ExperimentalBuild'))),
				exact('Debug', boolText(infoBool(info, 'Debug'))),
				exact('IPv4 Forwarding', boolText(infoBool(info, 'IPv4Forwarding'))),
				exact('Memory Limit', boolText(infoBool(info, 'MemoryLimit'))),
				exact('Swap Limit', boolText(infoBool(info, 'SwapLimit')))
			]
		}
	];
	const list = warnings(info);
	if (list && list.length > 0)
		groups.push({ title: 'Warnings', rows: list.map((warning) => exact('Warning', warning)) });
	return groups;
}

export function headerStatus(
	environment: Environment | undefined,
	environmentError: string | undefined
): string | undefined {
	if (environmentError !== undefined) return 'unavailable';
	if (environment?.enabled === false) return 'disabled';
	return environment?.status;
}
