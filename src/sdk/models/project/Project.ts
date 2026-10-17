/** Port of Models/Project/Project.swift. */
import type { JSONValue } from '../../types/json';
import type { ContainerRegistryCredential } from '../containerRegistry/ContainerRegistry';
import { D } from '../base/decoding';
import type { ISODateString } from '../base/date';
import type { PaginationResponse } from '../base/pagination';
import type { ProjectFile, ProjectFileChange, ProjectFileDraft } from './ProjectFiles';
import type { ProjectTag } from './ProjectTag';

/**
 * IncludeFile represents a project-related file (compose include, env file, or
 * other on-disk file shown in the project view).
 */
export interface IncludeFile {
	path: string;
	relativePath: string;
	content?: string;
}

/** CreateProject is the body for `POST /environments/{id}/projects`. */
export interface CreateProject {
	name: string;
	composeContent: string;
	envContent?: string;
	projectFiles?: ProjectFileDraft[];
}

/** UpdateProject is the body for `PUT /environments/{id}/projects/{id}`. */
export interface UpdateProject {
	name?: string;
	composeContent?: string;
	envContent?: string;
	fileTreeRevision?: string;
	fileChanges?: ProjectFileChange[];
}

/** DeployOptions configures the deploy/up call. */
export interface DeployOptions {
	pullPolicy?: string;
	forceRecreate?: boolean;
	removeOrphans?: boolean;
	recreateVolumes?: boolean;
}

/** UpdateIncludeFile is the body for the include file update endpoint. */
export interface UpdateIncludeFile {
	relativePath: string;
	content: string;
}

/** RuntimeService contains live container state for one compose service. */
export interface RuntimeService {
	name: string;
	image: string;
	status: string;
	containerId?: string;
	containerName?: string;
	ports?: string[];
	health?: string;
	iconUrl?: string;
	iconLightUrl?: string;
	iconDarkUrl?: string;
	serviceConfig?: Record<string, JSONValue>;
	redeployDisabled?: boolean;
}

/** ProjectUpdateInfo summarises image update status for the whole project. */
export interface ProjectUpdateInfo {
	status: string;
	hasUpdate: boolean;
	imageCount: number;
	checkedImageCount: number;
	imagesWithUpdates: number;
	errorCount: number;
	errorMessage?: string;
	imageRefs?: string[];
	updatedImageRefs?: string[];
	lastCheckedAt?: ISODateString;
}

/** ProjectCreateResponse is the response for `POST projects`. */
export interface ProjectCreateResponse {
	id: string;
	name: string;
	dirName?: string;
	relativePath?: string;
	path: string;
	status: string;
	statusReason?: string;
	serviceCount: number;
	runningCount: number;
	gitOpsManagedBy?: string;
	isArchived: boolean;
	archivedAt?: ISODateString;
	createdAt: string;
	updatedAt: string;
	/** JSON key `activityId`. */
	activityID?: string;
}

export const ProjectCreateResponse = {
	make(
		this: void,
		args: Omit<ProjectCreateResponse, 'serviceCount' | 'runningCount' | 'isArchived'> & {
			serviceCount?: number;
			runningCount?: number;
			isArchived?: boolean;
		}
	): ProjectCreateResponse {
		return {
			...args,
			serviceCount: args.serviceCount ?? 0,
			runningCount: args.runningCount ?? 0,
			isArchived: args.isArchived ?? false
		};
	},

	decode(this: void, raw: unknown): ProjectCreateResponse {
		const o = D.object(raw, 'ProjectCreateResponse');
		return {
			id: D.string(o, 'id'),
			name: D.string(o, 'name'),
			dirName: D.optString(o, 'dirName'),
			relativePath: D.optString(o, 'relativePath'),
			path: D.string(o, 'path'),
			status: D.string(o, 'status'),
			statusReason: D.optString(o, 'statusReason'),
			serviceCount: D.int(o, 'serviceCount'),
			runningCount: D.int(o, 'runningCount'),
			gitOpsManagedBy: D.optString(o, 'gitOpsManagedBy'),
			isArchived: D.boolean(o, 'isArchived'),
			archivedAt: D.optString(o, 'archivedAt'),
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.string(o, 'updatedAt'),
			activityID: D.optString(o, 'activityId')
		};
	},

	encode(this: void, value: ProjectCreateResponse): Record<string, unknown> {
		const { activityID, ...rest } = value;
		return { ...rest, activityId: activityID };
	}
} as const;

/** ProjectDetails is the full project view returned by the list/details endpoints. */
export interface ProjectDetails {
	id: string;
	name: string;
	dirName?: string;
	relativePath?: string;
	path: string;
	iconUrl?: string;
	iconLightUrl?: string;
	iconDarkUrl?: string;
	urls?: string[];
	tags?: ProjectTag[];
	composeContent?: string;
	composeFileName?: string;
	envContent?: string;
	includeFiles?: IncludeFile[];
	directoryFiles?: IncludeFile[];
	projectFiles?: ProjectFile[];
	fileTreeRevision?: string;
	status: string;
	statusReason?: string;
	serviceCount: number;
	runningCount: number;
	isArchived: boolean;
	isDiscovered?: boolean;
	archivedAt?: ISODateString;
	createdAt: string;
	updatedAt: string;
	services?: Record<string, JSONValue>[];
	runtimeServices?: RuntimeService[];
	updateInfo?: ProjectUpdateInfo;
	hasBuildDirective?: boolean;
	redeployDisabled?: boolean;
	gitOpsManagedBy?: string;
	lastSyncCommit?: string;
	gitRepositoryURL?: string;
	/** JSON key `activityId`. */
	activityID?: string;
}

export const ProjectDetails = {
	make(
		this: void,
		args: Omit<ProjectDetails, 'serviceCount' | 'runningCount' | 'isArchived'> & {
			serviceCount?: number;
			runningCount?: number;
			isArchived?: boolean;
		}
	): ProjectDetails {
		return {
			...args,
			serviceCount: args.serviceCount ?? 0,
			runningCount: args.runningCount ?? 0,
			isArchived: args.isArchived ?? false
		};
	},

	decode(this: void, raw: unknown): ProjectDetails {
		const o = D.object(raw, 'ProjectDetails');
		return {
			id: D.string(o, 'id'),
			name: D.string(o, 'name'),
			dirName: D.optString(o, 'dirName'),
			relativePath: D.optString(o, 'relativePath'),
			path: D.string(o, 'path'),
			iconUrl: D.optString(o, 'iconUrl'),
			iconLightUrl: D.optString(o, 'iconLightUrl'),
			iconDarkUrl: D.optString(o, 'iconDarkUrl'),
			urls: D.optArray(o, 'urls', D.str),
			tags: D.optArray(o, 'tags', D.cast<ProjectTag>),
			composeContent: D.optString(o, 'composeContent'),
			composeFileName: D.optString(o, 'composeFileName'),
			envContent: D.optString(o, 'envContent'),
			includeFiles: D.optArray(o, 'includeFiles', D.cast<IncludeFile>),
			directoryFiles: D.optArray(o, 'directoryFiles', D.cast<IncludeFile>),
			projectFiles: D.optArray(o, 'projectFiles', D.cast<ProjectFile>),
			fileTreeRevision: D.optString(o, 'fileTreeRevision'),
			status: D.string(o, 'status'),
			statusReason: D.optString(o, 'statusReason'),
			serviceCount: D.int(o, 'serviceCount'),
			runningCount: D.int(o, 'runningCount'),
			isArchived: D.boolean(o, 'isArchived'),
			isDiscovered: D.optBoolean(o, 'isDiscovered'),
			archivedAt: D.optString(o, 'archivedAt'),
			createdAt: D.string(o, 'createdAt'),
			updatedAt: D.string(o, 'updatedAt'),
			services: D.optArray(
				o,
				'services',
				(item) => D.object(item, 'service') as Record<string, JSONValue>
			),
			runtimeServices: D.optArray(o, 'runtimeServices', D.cast<RuntimeService>),
			updateInfo: D.optNested(o, 'updateInfo', D.cast<ProjectUpdateInfo>),
			hasBuildDirective: D.optBoolean(o, 'hasBuildDirective'),
			redeployDisabled: D.optBoolean(o, 'redeployDisabled'),
			gitOpsManagedBy: D.optString(o, 'gitOpsManagedBy'),
			lastSyncCommit: D.optString(o, 'lastSyncCommit'),
			gitRepositoryURL: D.optString(o, 'gitRepositoryURL'),
			activityID: D.optString(o, 'activityId')
		};
	},

	encode(this: void, value: ProjectDetails): Record<string, unknown> {
		const { activityID, ...rest } = value;
		return { ...rest, activityId: activityID };
	}
} as const;

/** DestroyProject is the body for the destroy endpoint. */
export interface DestroyProject {
	removeFiles?: boolean;
	removeVolumes?: boolean;
}

/** ProjectStatusCounts summarises project status counts for an environment. */
export interface ProjectStatusCounts {
	runningProjects: number;
	stoppedProjects: number;
	totalProjects: number;
	archivedProjects: number;
}

export const ProjectStatusCounts = {
	make(args: Partial<ProjectStatusCounts> = {}): ProjectStatusCounts {
		return {
			runningProjects: args.runningProjects ?? 0,
			stoppedProjects: args.stoppedProjects ?? 0,
			totalProjects: args.totalProjects ?? 0,
			archivedProjects: args.archivedProjects ?? 0
		};
	}
} as const;

/** ImagePullRequest is the body for `POST projects/{id}/pull`. */
export interface ImagePullRequest {
	credentials?: ContainerRegistryCredential[];
}

/** BuildProjectRequest is the body for `POST projects/{id}/build`. */
export interface BuildProjectRequest {
	services?: string[];
	provider?: string;
	push?: boolean;
	load?: boolean;
}

/** ProjectListPage is the page envelope for `GET /environments/{id}/projects`. */
export interface ProjectListPage {
	success: boolean;
	data: ProjectDetails[];
	pagination: PaginationResponse;
}

export const ProjectListPage = {
	decode(raw: unknown): ProjectListPage {
		const o = D.object(raw, 'ProjectListPage');
		return {
			success: D.boolean(o, 'success'),
			data: D.array(o, 'data', ProjectDetails.decode),
			pagination: D.nested(o, 'pagination', D.cast<PaginationResponse>)
		};
	}
} as const;
