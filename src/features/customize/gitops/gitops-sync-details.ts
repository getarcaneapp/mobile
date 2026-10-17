import { parseURL } from '@/sdk/client/url';
import { parseArcaneDate } from '@/sdk/models/base/date';
import { capitalized } from '@/ui/components/resource-status';

import {
	isJSONObject,
	type DynamicResource,
	type JSONObject
} from '../dynamic-resources/dynamic-resource';

export type GitOpsSyncMode = 'deploy' | 'backup';

export interface StatusPresentation {
	status: string;
	label: string;
}

export interface GitOpsSyncDetails {
	id: string;
	name: string;
	environmentID?: string;
	mode: GitOpsSyncMode;
	repositoryID?: string;
	repositoryName?: string;
	repositoryURL?: string;
	branch?: string;
	composePath?: string;
	targetType?: string;
	projectName?: string;
	projectID?: string;
	autoSync: boolean;
	syncIntervalMinutes: number;
	syncDirectory: boolean;
	pullImageAfterSync: boolean;
	redeployAfterSync: boolean;
	syncedFiles: string[];
	maxSyncFiles: number;
	maxSyncTotalSize: number;
	maxSyncBinarySize: number;
	lastSyncAt?: Date;
	lastSyncStatus?: string;
	lastSyncError?: string;
	lastSyncCommit?: string;
	backupDirectory?: string;
	backupPaths: string[];
	backupOnSave: boolean;
	backupPending: boolean;
	backupState: string;
	backupFailureReason?: string;
	lastBackupAt?: Date;
	preDeployScriptPath?: string;
	preDeployRunnerImage?: string;
	preDeployLastRunStatus?: string;
	preDeployLastRunAt?: Date;
	createdAt?: Date;
	updatedAt?: Date;
}

function reader(values: JSONObject) {
	const string = (key: string) => {
		const value = values[key];
		if (typeof value !== 'string') return undefined;
		const trimmed = value.trim();
		return trimmed === '' ? undefined : trimmed;
	};
	return {
		string,
		bool: (key: string) => values[key] === true,
		integer: (key: string) => {
			const value = values[key];
			if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0;
			if (typeof value === 'string' && /^[+-]?\d+$/.test(value)) return Number(value);
			return 0;
		},
		stringArray: (key: string) => {
			const value = values[key];
			return Array.isArray(value)
				? value.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
				: [];
		},
		date: (key: string) => parseArcaneDate(string(key))
	};
}

function decodeFileList(raw: string | undefined): string[] {
	if (raw === undefined) return [];
	try {
		const files: unknown = JSON.parse(raw);
		return Array.isArray(files)
			? files.filter((file): file is string => typeof file === 'string' && file !== '')
			: [];
	} catch {
		return [];
	}
}

function stripGitSuffix(path: string): string {
	return path.endsWith('.git') ? path.slice(0, -4) : path;
}

const trimSlashes = (path: string) => path.replace(/^\/+|\/+$/g, '');

export const GitOpsSyncDetails = {
	fromResource(resource: DynamicResource): GitOpsSyncDetails {
		return GitOpsSyncDetails.fromValues(resource.values, resource.id);
	},

	fromValues(values: JSONObject, fallbackID: string): GitOpsSyncDetails {
		const r = reader(values);
		const repositoryValue = values.repository;
		const repository = reader(isJSONObject(repositoryValue) ? repositoryValue : {});
		return {
			id: r.string('id') ?? fallbackID,
			name: r.string('name') ?? r.string('projectName') ?? fallbackID,
			environmentID: r.string('environmentId'),
			mode: r.string('mode') === 'backup' ? 'backup' : 'deploy',
			repositoryID: r.string('repositoryId') ?? repository.string('id'),
			repositoryName: repository.string('name'),
			repositoryURL: repository.string('url'),
			branch: r.string('branch'),
			composePath: r.string('composePath'),
			targetType: r.string('targetType'),
			projectName: r.string('projectName'),
			projectID: r.string('projectId'),
			autoSync: r.bool('autoSync'),
			syncIntervalMinutes: r.integer('syncInterval'),
			syncDirectory: r.bool('syncDirectory'),
			pullImageAfterSync: r.bool('pullImageAfterSync'),
			redeployAfterSync: r.bool('redeployAfterSync'),
			syncedFiles: decodeFileList(r.string('syncedFiles')),
			maxSyncFiles: r.integer('maxSyncFiles'),
			maxSyncTotalSize: r.integer('maxSyncTotalSize'),
			maxSyncBinarySize: r.integer('maxSyncBinarySize'),
			lastSyncAt: r.date('lastSyncAt'),
			lastSyncStatus: r.string('lastSyncStatus'),
			lastSyncError: r.string('lastSyncError'),
			lastSyncCommit: r.string('lastSyncCommit'),
			backupDirectory: r.string('backupDirectory'),
			backupPaths: r.stringArray('backupPaths'),
			backupOnSave: r.bool('backupOnSave'),
			backupPending: r.bool('backupPending'),
			backupState: r.string('backupState') ?? 'never',
			backupFailureReason: r.string('backupFailureReason'),
			lastBackupAt: r.date('lastBackupAt'),
			preDeployScriptPath: r.string('preDeployScriptPath'),
			preDeployRunnerImage: r.string('preDeployRunnerImage'),
			preDeployLastRunStatus: r.string('preDeployLastRunStatus'),
			preDeployLastRunAt: r.date('preDeployLastRunAt'),
			createdAt: r.date('createdAt'),
			updatedAt: r.date('updatedAt')
		};
	},

	isBackup: (sync: GitOpsSyncDetails) => sync.mode === 'backup',

	isSwarmStack: (sync: GitOpsSyncDetails) => sync.targetType === 'swarm_stack',

	targetLabel(sync: GitOpsSyncDetails): string {
		switch (sync.targetType) {
			case undefined:
			case 'project':
				return 'Project';
			case 'swarm_stack':
				return 'Swarm Stack';
			default:
				return capitalized(sync.targetType.replace(/_/g, ' '));
		}
	},

	shortCommit: (sync: GitOpsSyncDetails) => sync.lastSyncCommit?.slice(0, 7),

	syncIntervalDescription: (sync: GitOpsSyncDetails) =>
		GitOpsSyncDetails.intervalDescription(sync.syncIntervalMinutes),

	statusPresentation(sync: GitOpsSyncDetails): StatusPresentation {
		return GitOpsSyncDetails.isBackup(sync)
			? GitOpsSyncDetails.backupStatePresentation(sync.backupState)
			: GitOpsSyncDetails.syncStatusPresentation(sync.lastSyncStatus);
	},

	visibleError(sync: GitOpsSyncDetails): string | undefined {
		if (sync.lastSyncError === undefined) return undefined;
		if (GitOpsSyncDetails.isBackup(sync)) {
			return ['failed', 'needs_attention'].includes(sync.backupState)
				? sync.lastSyncError
				: undefined;
		}
		return sync.lastSyncStatus === 'failed' ? sync.lastSyncError : undefined;
	},

	backupFailureDescription(sync: GitOpsSyncDetails): string | undefined {
		switch (sync.backupFailureReason) {
			case undefined:
				return undefined;
			case 'repository':
				return 'Repository unreachable';
			case 'auth':
				return 'Authentication failed';
			case 'project_missing':
				return 'Project missing';
			case 'snapshot':
				return 'Snapshot failed';
			case 'unreadable_files':
				return 'Unreadable files';
			case 'limits':
				return 'File limits exceeded';
			case 'conflict':
				return 'Remote changes conflict';
			case 'destination_occupied':
				return 'Destination already in use';
			case 'push_rejected':
				return 'Push rejected';
			default:
				return capitalized(sync.backupFailureReason.replace(/_/g, ' '));
		}
	},

	repositoryWebURL: (sync: GitOpsSyncDetails) =>
		sync.repositoryURL === undefined ? undefined : GitOpsSyncDetails.webURL(sync.repositoryURL),

	commitURL(sync: GitOpsSyncDetails): string | undefined {
		if (sync.repositoryURL === undefined || sync.lastSyncCommit === undefined) return undefined;
		return GitOpsSyncDetails.commitURLFor(sync.repositoryURL, sync.lastSyncCommit);
	},

	syncStatusPresentation(status: string | undefined): StatusPresentation {
		switch (status?.toLowerCase()) {
			case 'success':
				return { status: 'success', label: 'Synced' };
			case 'failed':
				return { status: 'failed', label: 'Failed' };
			case 'pending':
				return { status: 'starting', label: 'Pending' };
			default:
				return { status: '', label: 'Not Synced' };
		}
	},

	backupStatePresentation(state: string): StatusPresentation {
		switch (state) {
			case 'pending':
				return { status: 'partial', label: 'Pending Changes' };
			case 'backing_up':
				return { status: 'starting', label: 'Backing Up' };
			case 'backed_up':
				return { status: 'success', label: 'Backed Up' };
			case 'paused':
				return { status: 'paused', label: 'Paused' };
			case 'failed':
				return { status: 'failed', label: 'Failed' };
			case 'needs_attention':
				return { status: 'error', label: 'Needs Attention' };
			default:
				return { status: '', label: 'Not Backed Up' };
		}
	},

	intervalDescription(minutes: number): string {
		if (minutes <= 0) return 'Manual';
		let value = minutes;
		let unit = 'minute';
		if (minutes % 1440 === 0) {
			value = minutes / 1440;
			unit = 'day';
		} else if (minutes % 60 === 0) {
			value = minutes / 60;
			unit = 'hour';
		}
		return value === 1 ? `Every ${unit}` : `Every ${value} ${unit}s`;
	},

	webURL(raw: string): string | undefined {
		const trimmed = raw.trim();
		if (trimmed === '') return undefined;
		if (trimmed.includes('://')) {
			const url = parseURL(trimmed);
			if (!url || url.host === '') return undefined;
			const isWeb = url.scheme === 'http' || url.scheme === 'https';
			const host = isWeb ? url.host + (url.port !== undefined ? `:${url.port}` : '') : url.host;
			const stripped = stripGitSuffix(trimSlashes(url.path));
			if (stripped === '') return undefined;
			return `${isWeb ? url.scheme : 'https'}://${host}/${stripped}`;
		}
		const at = trimmed.indexOf('@');
		const withoutUser = at >= 0 ? trimmed.slice(at + 1) : trimmed;
		const separator = withoutUser.search(/[:/]/);
		if (separator < 0) return undefined;
		const host = withoutUser.slice(0, separator);
		const stripped = stripGitSuffix(trimSlashes(withoutUser.slice(separator + 1)));
		if (host === '' || stripped === '') return undefined;
		return `https://${host}/${stripped}`;
	},

	commitURLFor(repository: string, commit: string): string | undefined {
		const base = GitOpsSyncDetails.webURL(repository);
		if (base === undefined) return undefined;
		const host = parseURL(base)?.host.toLowerCase();
		if (host === undefined) return undefined;
		const encodedCommit = commit.replace(/[^A-Za-z0-9]/g, (character) =>
			encodeURIComponent(character)
		);
		if (encodedCommit === '') return undefined;
		const segment = host.includes('gitlab')
			? '/-/commit/'
			: host.includes('bitbucket')
				? '/commits/'
				: '/commit/';
		return base + segment + encodedCommit;
	}
} as const;
