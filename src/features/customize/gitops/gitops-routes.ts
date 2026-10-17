/** GitOps sync fields and the sync detail route (GitOpsSyncsView.swift → GitOpsSyncDetailView.swift). */
import {
	settingsPayloads,
	useSettingsNavigation
} from '@/features/settings/shared/settings-routes';
import type { EnvironmentID } from '@/sdk/client/environment';

import {
	backendFormField,
	dynamicEditConfig,
	type BackendFormField,
	type DynamicResource
} from '../dynamic-resources/dynamic-resource';

/** Fields accepted by both the create and update requests; the server rejects unknown keys. */
export const gitOpsSyncFields: BackendFormField[] = [
	backendFormField('name', 'Name', { required: true }),
	backendFormField('repositoryId', 'Repository ID', { required: true }),
	backendFormField('branch', 'Branch', { required: true, placeholder: 'main' }),
	backendFormField('composePath', 'Compose Path', { required: true, placeholder: 'compose.yaml' }),
	backendFormField('autoSync', 'Auto Sync', { type: { kind: 'toggle' } })
];

export const gitOpsSyncEditConfig = dynamicEditConfig('Edit GitOps Sync', gitOpsSyncFields);

export const GitOpsRoutes = {
	sync: 'settings/customize/gitops-sync'
} as const;

export interface GitOpsSyncPayload {
	resource: DynamicResource;
	/** The environment the sync belongs to, which can differ from the active one in All Environments lists. */
	environmentID: EnvironmentID;
	/** Called after an action changes the sync so the presenting list can reload. */
	onChange: () => void;
}

export function useGitOpsNavigation() {
	const nav = useSettingsNavigation();
	return {
		...nav,
		openSync(payload: GitOpsSyncPayload) {
			nav.push(GitOpsRoutes.sync, {
				id: payload.resource.id,
				envID: payload.environmentID,
				token: settingsPayloads.put(payload)
			});
		}
	};
}
