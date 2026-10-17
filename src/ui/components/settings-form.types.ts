/**
 * Port of the definitions in `EnvironmentSettingsForm.swift`:
 * `SettingFieldDef`, `SettingFieldCondition`, `SettingFieldType`,
 * `SettingsCategoryDef`, `SettingsSectionDef`, the environment settings tab
 * sections, `EnvironmentSecuritySection`, and the server-wide categories
 * (`activityHistorySettings`, `timeoutSettings`). Pure TS.
 */

export type SettingFieldCondition = { key: string; value: string };

export type SettingFieldType =
	| { kind: 'text' }
	| { kind: 'number' }
	| { kind: 'boolean' }
	| { kind: 'password' }
	| { kind: 'select'; options: string[] }
	| { kind: 'networkSelect' }
	| { kind: 'cron' }
	| { kind: 'textarea' }
	/** Multi-select checklist of running containers → comma-separated names. */
	| { kind: 'containerMultiSelect' };

export type SettingFieldDef = {
	key: string;
	label: string;
	type: SettingFieldType;
	description?: string;
	minValue?: number;
	maxValue?: number;
	/**
	 * Force the stacked (caption-above-field) layout for long free-text values
	 * like URLs, paths, and comma-separated lists. Short values stay inline.
	 */
	stacked?: boolean;
	visibleWhen?: SettingFieldCondition;
};

export type SettingsSectionDef = { id: string; title: string; fields: SettingFieldDef[] };

export type SettingsCategoryDef = {
	id: string;
	title: string;
	icon: string;
	summary: string;
	sections: SettingsSectionDef[];
};

/** `SettingsCategoryDef.fields`. */
export const categoryFields = (category: SettingsCategoryDef): SettingFieldDef[] =>
	sectionFields(category.sections);

export const sectionFields = (sections: SettingsSectionDef[]): SettingFieldDef[] =>
	sections.flatMap((section) => section.fields);

const text: SettingFieldType = { kind: 'text' };
const number: SettingFieldType = { kind: 'number' };
const boolean: SettingFieldType = { kind: 'boolean' };
const password: SettingFieldType = { kind: 'password' };
const textarea: SettingFieldType = { kind: 'textarea' };
const select = (options: string[]): SettingFieldType => ({ kind: 'select', options });
const networkSelect: SettingFieldType = { kind: 'networkSelect' };
const containerMultiSelect: SettingFieldType = { kind: 'containerMultiSelect' };

// MARK: - Environment settings tabs

/**
 * Settings shown on an environment's detail page, grouped like the web's
 * environment tabs. Each tab's sections save through one shared draft.
 */
export const environmentFeatureSections: SettingsSectionDef[] = [
	{
		id: 'features',
		title: 'Features',
		fields: [
			{
				key: 'featureVulnerabilityManagementEnabled',
				label: 'Vulnerability Management',
				type: boolean,
				description: 'Image scanning, vulnerability reports, and patching.'
			},
			{
				key: 'featureSwarmEnabled',
				label: 'Swarm',
				type: boolean,
				description: 'Swarm services, stacks, nodes, and secrets.'
			}
		]
	}
];

export const environmentStorageSections: SettingsSectionDef[] = [
	{
		id: 'directories-storage-paths',
		title: 'Directories & Storage Paths',
		fields: [
			{ key: 'projectsDirectory', label: 'Projects Directory', type: text, stacked: true },
			{ key: 'templatesDirectory', label: 'Templates Directory', type: text, stacked: true },
			{
				key: 'swarmStackSourcesDirectory',
				label: 'Swarm Stack Sources',
				type: text,
				stacked: true
			},
			{ key: 'diskUsagePath', label: 'Disk Usage Path', type: text, stacked: true },
			{ key: 'followProjectSymlinks', label: 'Follow Project Symlinks', type: boolean }
		]
	},
	{
		id: 'upload-limits',
		title: 'Upload Limits',
		fields: [{ key: 'maxImageUploadSize', label: 'Max Image Upload (MB)', type: number }]
	},
	{
		id: 'git-sync-limits',
		title: 'Git Sync File Limits',
		fields: [
			{ key: 'gitSyncMaxFiles', label: 'Max Files', type: number },
			{ key: 'gitSyncMaxTotalSizeMb', label: 'Total Size (MB)', type: number },
			{ key: 'gitSyncMaxBinarySizeMb', label: 'Binary File Size (MB)', type: number }
		]
	}
];

export const environmentDockerSections: SettingsSectionDef[] = [
	{
		id: 'docker',
		title: 'Docker Settings',
		fields: [
			{ key: 'baseServerUrl', label: 'Base Server URL', type: text, stacked: true },
			{
				key: 'defaultShell',
				label: 'Default Shell',
				type: select(['/bin/sh', '/bin/bash', '/bin/ash', '/bin/zsh'])
			},
			{
				key: 'defaultDeployPullPolicy',
				label: 'Default Pull Policy',
				type: select(['missing', 'always', 'never'])
			},
			{ key: 'autoInjectEnv', label: 'Auto-Inject .env', type: boolean },
			{ key: 'toolsImageRegistry', label: 'Tools Image Registry', type: text, stacked: true },
			{ key: 'updateCheckRegistry', label: 'Update Check Registry', type: text, stacked: true }
		]
	},
	{
		id: 'prune-options',
		title: 'Prune Options',
		fields: [
			{
				key: 'pruneContainerMode',
				label: 'Prune Containers',
				type: select(['none', 'stopped', 'olderThan'])
			},
			{
				key: 'pruneContainerUntil',
				label: 'Container Age Filter',
				type: text,
				visibleWhen: { key: 'pruneContainerMode', value: 'olderThan' }
			},
			{
				key: 'pruneImageMode',
				label: 'Prune Images',
				type: select(['none', 'dangling', 'all', 'olderThan'])
			},
			{
				key: 'pruneImageUntil',
				label: 'Image Age Filter',
				type: text,
				visibleWhen: { key: 'pruneImageMode', value: 'olderThan' }
			},
			{
				key: 'pruneVolumeMode',
				label: 'Prune Volumes',
				type: select(['none', 'anonymous', 'all'])
			},
			{
				key: 'pruneNetworkMode',
				label: 'Prune Networks',
				type: select(['none', 'unused', 'olderThan'])
			},
			{
				key: 'pruneNetworkUntil',
				label: 'Network Age Filter',
				type: text,
				visibleWhen: { key: 'pruneNetworkMode', value: 'olderThan' }
			},
			{
				key: 'pruneBuildCacheMode',
				label: 'Prune Build Cache',
				type: select(['none', 'unused', 'all', 'olderThan'])
			},
			{
				key: 'pruneBuildCacheUntil',
				label: 'Build Cache Age Filter',
				type: text,
				visibleWhen: { key: 'pruneBuildCacheMode', value: 'olderThan' }
			}
		]
	}
];

/** The web's Security tab sub-tabs (`EnvironmentSecuritySection`). */
export type EnvironmentSecuritySection = 'Scanning' | 'Patching' | 'Lifecycle';

export const environmentSecuritySectionCases: EnvironmentSecuritySection[] = [
	'Scanning',
	'Patching',
	'Lifecycle'
];

export const environmentSecuritySections: Record<EnvironmentSecuritySection, SettingsSectionDef[]> =
	{
		Scanning: [
			{
				id: 'vulnerability-scanning',
				title: 'Vulnerability Scanning',
				fields: [
					{ key: 'trivyDbRegistry', label: 'Database Registry', type: text, stacked: true },
					{
						key: 'trivyNetwork',
						label: 'Network',
						type: networkSelect,
						description:
							"Auto inherits Arcane's network. Choose a built-in or custom Docker network to override it."
					},
					{
						key: 'trivyConcurrentScanContainers',
						label: 'Concurrent Scans',
						type: number,
						minValue: 1
					},
					{ key: 'trivyIgnoreUnfixed', label: 'Ignore Unfixed', type: boolean },
					{ key: 'vulnerabilityThreatIntelEnabled', label: 'Threat Intelligence', type: boolean },
					{ key: 'trivyPrivileged', label: 'Privileged Mode', type: boolean },
					{ key: 'trivySecurityOpts', label: 'Security Options', type: textarea }
				]
			},
			{
				id: 'scanner-resources',
				title: 'Resource Limits',
				fields: [
					{ key: 'trivyResourceLimitsEnabled', label: 'Limit Resources', type: boolean },
					{
						key: 'trivyCpuLimit',
						label: 'CPU Limit',
						type: text,
						visibleWhen: { key: 'trivyResourceLimitsEnabled', value: 'true' }
					},
					{
						key: 'trivyMemoryLimitMb',
						label: 'Memory Limit (MB)',
						type: number,
						visibleWhen: { key: 'trivyResourceLimitsEnabled', value: 'true' }
					}
				]
			},
			{
				id: 'trivy-server',
				title: 'Trivy Server',
				fields: [
					{ key: 'trivyServerEnabled', label: 'Use Trivy Server', type: boolean },
					{
						key: 'trivyServerUrl',
						label: 'Server URL',
						type: text,
						stacked: true,
						visibleWhen: { key: 'trivyServerEnabled', value: 'true' }
					},
					{
						key: 'trivyServerToken',
						label: 'Token',
						type: password,
						visibleWhen: { key: 'trivyServerEnabled', value: 'true' }
					}
				]
			},
			{
				id: 'trivy-config',
				title: 'Configuration',
				fields: [
					{ key: 'trivyConfig', label: 'Trivy Config (YAML)', type: textarea },
					{ key: 'trivyIgnore', label: '.trivyignore', type: textarea }
				]
			}
		],
		Patching: [
			{
				id: 'image-patching',
				title: 'Image Patching',
				fields: [
					{ key: 'imageAutoPatchEnabled', label: 'Auto-Patch Images', type: boolean },
					{ key: 'imagePatchAllPlatforms', label: 'Patch All Platforms', type: boolean },
					{ key: 'imagePatchSuffix', label: 'Tag Suffix', type: text },
					{ key: 'imagePatchTimeoutSec', label: 'Timeout (s)', type: number, minValue: 1 }
				]
			}
		],
		Lifecycle: [
			{
				id: 'lifecycle-hooks',
				title: 'Lifecycle Hooks',
				fields: [
					{ key: 'lifecycleEnabled', label: 'Lifecycle Hooks', type: boolean },
					{
						key: 'lifecycleDefaultRunnerImage',
						label: 'Default Runner Image',
						type: text,
						stacked: true
					},
					{ key: 'lifecycleMaxTimeoutSec', label: 'Max Timeout (s)', type: number, minValue: 1 }
				]
			}
		]
	};

export const environmentAutomationSections: SettingsSectionDef[] = [
	{
		id: 'updates',
		title: 'Updates',
		fields: [
			{ key: 'pollingEnabled', label: 'Image Polling', type: boolean },
			{ key: 'imageEventWatcherEnabled', label: 'Image Event Watcher', type: boolean },
			{ key: 'autoUpdate', label: 'Auto-Update', type: boolean },
			{
				key: 'autoUpdateExcludedContainers',
				label: 'Excluded Containers',
				type: containerMultiSelect
			}
		]
	},
	{
		id: 'monitoring',
		title: 'Monitoring',
		fields: [
			{ key: 'autoHealEnabled', label: 'Auto-Heal', type: boolean },
			{
				key: 'autoHealExcludedContainers',
				label: 'Excluded Containers',
				type: containerMultiSelect
			},
			{ key: 'autoHealMaxRestarts', label: 'Max Restarts', type: number },
			{ key: 'autoHealRestartWindow', label: 'Restart Window (min)', type: number }
		]
	},
	{
		id: 'maintenance',
		title: 'Maintenance',
		fields: [
			{ key: 'scheduledPruneEnabled', label: 'Scheduled Pruning', type: boolean },
			{ key: 'vulnerabilityScanEnabled', label: 'Scheduled Vulnerability Scans', type: boolean }
		]
	}
];

// MARK: - Server-wide settings

/**
 * Settings that apply to the whole Arcane server, stored on the local
 * environment like the web's Settings pages.
 */
export const activityHistorySettings: SettingsCategoryDef = {
	id: 'activity',
	title: 'Activity History',
	icon: 'list.bullet.rectangle',
	summary: 'Activity Center history retention',
	sections: [
		{
			id: 'activity-history',
			title: 'Activity History',
			fields: [
				{
					key: 'activityHistoryRetentionDays',
					label: 'Retention (days)',
					type: number,
					minValue: 0,
					maxValue: 3650
				},
				{
					key: 'activityHistoryMaxEntries',
					label: 'Max Entries',
					type: number,
					minValue: 0,
					maxValue: 100000
				}
			]
		}
	]
};

export const timeoutSettings: SettingsCategoryDef = {
	id: 'timeouts',
	title: 'Timeouts',
	icon: 'clock',
	summary: 'Docker, Git, and network operation timeouts',
	sections: [
		{
			id: 'docker-operations',
			title: 'Docker Operations',
			fields: [
				{
					key: 'dockerApiTimeout',
					label: 'Docker API (s)',
					type: number,
					minValue: 1,
					maxValue: 3600
				},
				{
					key: 'dockerImagePullTimeout',
					label: 'Image Pull (s)',
					type: number,
					minValue: 30,
					maxValue: 7200
				},
				{
					key: 'trivyScanTimeout',
					label: 'Trivy Scan (s)',
					type: number,
					minValue: 60,
					maxValue: 14400
				}
			]
		},
		{
			id: 'git-operations',
			title: 'Git Operations',
			fields: [
				{
					key: 'gitOperationTimeout',
					label: 'Git Operation (s)',
					type: number,
					minValue: 30,
					maxValue: 3600
				}
			]
		},
		{
			id: 'network-operations',
			title: 'Network Operations',
			fields: [
				{
					key: 'httpClientTimeout',
					label: 'HTTP Client (s)',
					type: number,
					minValue: 5,
					maxValue: 300
				},
				{ key: 'registryTimeout', label: 'Registry (s)', type: number, minValue: 5, maxValue: 300 },
				{
					key: 'proxyRequestTimeout',
					label: 'Proxy Request (s)',
					type: number,
					minValue: 10,
					maxValue: 600
				}
			]
		}
	]
};

// MARK: - Field row helpers (SettingFieldRow)

/** `SettingFieldRow.rangeHint`. */
export function rangeHint(field: SettingFieldDef): string | undefined {
	const { minValue: min, maxValue: max } = field;
	if (min !== undefined && max !== undefined) return `Allowed: ${min}–${max}`;
	if (min !== undefined) return `Minimum: ${min}`;
	if (max !== undefined) return `Maximum: ${max}`;
	return undefined;
}

/** `SettingFieldRow.networkOptions(selected:)`: "" is Auto. */
export function networkOptions(networkNames: string[], selected: string): string[] {
	const options = ['', 'bridge', 'host', 'none'];
	for (const name of networkNames) if (!options.includes(name)) options.push(name);
	if (selected !== '' && !options.includes(selected)) options.push(selected);
	return options;
}

/** "None" or the number of excluded container names. */
export function excludedCountLabel(raw: string): string {
	const count = raw
		.split(',')
		.map((name) => name.trim())
		.filter((name) => name !== '').length;
	return count === 0 ? 'None' : String(count);
}

/** `SettingFieldRow.optionLabel`: "olderThan" → "Older Than", "dangling" → "Dangling". */
export function optionLabel(raw: string): string {
	if (raw === '' || raw.startsWith('/')) return raw;
	let spaced = '';
	for (const character of raw) {
		const isUppercase =
			character !== character.toLowerCase() && character === character.toUpperCase();
		if (isUppercase && spaced !== '') spaced += ' ';
		spaced += character;
	}
	return spaced
		.split(' ')
		.filter((word) => word !== '')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/** Toggle state for a boolean setting (`"true"`, case-insensitive). */
export const settingBool = (raw: string) => raw.toLowerCase() === 'true';

/** Swift's `Int(String)`: whole-string signed integer, else undefined. */
export function swiftInt(raw: string): number | undefined {
	return /^[+-]?\d+$/.test(raw) ? Number(raw) : undefined;
}

// MARK: - ContainerMultiSelectView helpers

/** Strips any leading "/" from a container name. */
export function normalizeContainerName(name: string): string {
	let value = name;
	while (value.startsWith('/')) value = value.slice(1);
	return value;
}

export function selectedContainerNames(selection: string): Set<string> {
	return new Set(
		selection
			.split(',')
			.map((name) => normalizeContainerName(name.trim()))
			.filter((name) => name !== '')
	);
}

export type ContainerSelectRow = { name: string; isRunning: boolean };

const swiftSort = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Running containers, then already-excluded names that aren't running. */
export function containerSelectRows(
	runningNames: string[],
	selection: string
): ContainerSelectRow[] {
	const running = runningNames.map((name) => ({ name, isRunning: true }));
	const runningSet = new Set(runningNames);
	const orphaned = [...selectedContainerNames(selection)]
		.filter((name) => !runningSet.has(name))
		.sort(swiftSort)
		.map((name) => ({ name, isRunning: false }));
	return [...running, ...orphaned];
}

export function filterContainerSelectRows(
	rows: ContainerSelectRow[],
	search: string
): ContainerSelectRow[] {
	if (search === '') return rows;
	const needle = search.toLocaleLowerCase();
	return rows.filter((row) => row.name.toLocaleLowerCase().includes(needle));
}

/** Toggles `name` in the comma-separated selection (sorted, comma-joined like the web). */
export function toggleContainerSelection(selection: string, name: string): string {
	const normalized = normalizeContainerName(name);
	const set = selectedContainerNames(selection);
	if (set.has(normalized)) set.delete(normalized);
	else set.add(normalized);
	return [...set].sort(swiftSort).join(',');
}
