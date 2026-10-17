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
	environmentID: EnvironmentID;
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
