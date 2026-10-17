import { useRouter, useSegments, type Href } from 'expo-router';
import { useMemo } from 'react';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { DeployOptions, ProjectDetails } from '@/sdk/models/project/Project';
import type { ProjectTag } from '@/sdk/models/project/ProjectTag';

import { routePayloads } from '@/features/containers/container-routes';

import {
	encodeDestination,
	type ProjectFileDialog,
	type ProjectFileDialogResult,
	type ManagedProjectFileEntry,
	type ProjectFilesDestination
} from './project-files-model';

export { routePayloads };

const projectKey = (environmentID: EnvironmentID, id: string) => `${environmentID}/${id}`;
const projects = new Map<string, ProjectDetails>();

export const projectCache = {
	set: (environmentID: EnvironmentID, project: ProjectDetails) =>
		projects.set(projectKey(environmentID, project.id), project),
	get: (environmentID: EnvironmentID, id: string) => projects.get(projectKey(environmentID, id))
};

export type DeployOptionsPayload = { deploy: (options: DeployOptions) => void };
export type ProjectTagsPayload = { tags: ProjectTag[]; onChange: (tags: ProjectTag[]) => void };
export type CreateProjectPayload = {
	prefilledName?: string;
	prefilledCompose?: string;
	prefilledEnv?: string;
	templateLabel?: string;
	onSuccess?: () => Promise<void> | void;
};
export type DraftReviewPayload = {
	originalCompose: string;
	compose: string;
	environmentChanged: boolean;
	additionalChanges: string[];
	saveTitle?: string;
	canDeploy: boolean;
	onDismiss: (deploy: boolean) => void;
};
export type RenderComposePayload = {
	initialCompose: string;
	initialEnv: string;
	onApply: (resolved: string) => void;
};
export type ProjectFileDialogPayload = {
	dialog: ProjectFileDialog;
	folders: ManagedProjectFileEntry[];
	existingPaths: ReadonlySet<string>;
	composeFileName: string;
	onSubmit: (result: ProjectFileDialogResult) => string | undefined;
};

const deploymentSheetPath = 'deployment-activity';

type Params = Record<string, string | undefined>;

function query(params: Params) {
	const entries = Object.entries(params).filter(
		(entry): entry is [string, string] => entry[1] !== undefined
	);
	return entries.length === 0
		? ''
		: `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export function useProjectNavigation() {
	const router = useRouter();
	const segments = useSegments() as string[];
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(projects)';
	return useMemo(() => {
		const href = (path: string, params: Params = {}) =>
			`/(tabs)/${group}/${path}${query(params)}` as Href;
		const projectPath = (id: string, suffix = '') => `project/${encodeURIComponent(id)}${suffix}`;
		return {
			router,
			openDetail(this: void, environmentID: EnvironmentID, project: ProjectDetails) {
				projectCache.set(environmentID, project);
				router.push(href(projectPath(project.id), { envID: environmentID, name: project.name }));
			},
			openLogs(
				this: void,
				environmentID: EnvironmentID,
				projectID: string,
				title: string,
				storeToken?: string
			) {
				router.push(
					href(projectPath(projectID, '/logs'), { envID: environmentID, title, store: storeToken })
				);
			},
			openFilter(this: void, listKey: string) {
				router.push(href('projects-filter', { key: listKey }));
			},
			openArchived(this: void, environmentID: EnvironmentID) {
				router.push(href('archived-projects', { envID: environmentID }));
			},
			openTemplates(this: void) {
				router.push(href('templateRegistries'));
			},
			openCreate(this: void, environmentID: EnvironmentID, payload: CreateProjectPayload = {}) {
				router.push(
					href('create-project', { envID: environmentID, token: routePayloads.put(payload) })
				);
			},
			openDeployOptions(this: void, environmentID: EnvironmentID, payload: DeployOptionsPayload) {
				router.push(
					href('project-deploy-options', {
						envID: environmentID,
						token: routePayloads.put(payload)
					})
				);
			},
			openTags(
				this: void,
				environmentID: EnvironmentID,
				projectID: string,
				payload: ProjectTagsPayload
			) {
				router.push(
					href('project-tags', {
						envID: environmentID,
						projectID,
						token: routePayloads.put(payload)
					})
				);
			},
			openFiles(
				this: void,
				environmentID: EnvironmentID,
				project: ProjectDetails,
				selection: ProjectFilesDestination
			) {
				projectCache.set(environmentID, project);
				router.push(
					href('project-files', {
						envID: environmentID,
						projectID: project.id,
						selection: encodeDestination(selection)
					})
				);
			},
			openDraftReview(this: void, payload: DraftReviewPayload) {
				router.push(href('project-draft-review', { token: routePayloads.put(payload) }));
			},
			openComposeEditor(this: void, destination: string) {
				router.push(href('compose-editor', { destination }));
			},
			openRenderCompose(this: void, environmentID: EnvironmentID, payload: RenderComposePayload) {
				router.push(
					href('render-compose', { envID: environmentID, token: routePayloads.put(payload) })
				);
			},
			openFileDialog(this: void, payload: ProjectFileDialogPayload) {
				router.push(href('project-file-dialog', { token: routePayloads.put(payload) }));
			},
			openDeployment(this: void) {
				router.push(href(deploymentSheetPath));
			}
		};
	}, [router, group]);
}
