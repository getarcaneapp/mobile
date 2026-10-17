/** Port of `GitOpsSyncsView` (GitOpsSyncsView.swift): `appTabDestination(.gitOps)`. */
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';

import { backendListAction } from '../dynamic-resources/dynamic-resource';
import { DynamicResourceListView } from '../dynamic-resources/dynamic-resource-list-screen';
import { gitOpsSyncEditConfig, gitOpsSyncFields, useGitOpsNavigation } from './gitops-routes';

const actions = [
	backendListAction({
		id: 'sync',
		title: 'Sync Now',
		systemImage: 'arrow.clockwise',
		method: 'POST',
		pathSuffix: '/{id}/sync'
	}),
	backendListAction({
		id: 'delete',
		title: 'Delete',
		systemImage: 'trash',
		method: 'DELETE',
		pathSuffix: '/{id}',
		destructive: true
	})
];

const syncsPath = (environmentID: EnvironmentID, client: ArcaneClient) =>
	client.rest.environmentPath(environmentID, 'gitops-syncs');

export function GitOpsSyncsView({
	environmentID,
	allEnvironments
}: {
	environmentID: EnvironmentID;
	allEnvironments: boolean;
}) {
	const nav = useGitOpsNavigation();
	const canManageRepositories = useClientManager((s) => s.canAccess('gitRepositories'));
	return (
		<DynamicResourceListView
			title="GitOps"
			systemImage="arrow.triangle.branch"
			path={syncsPath}
			environmentID={environmentID}
			allEnvironments={allEnvironments}
			emptyTitle="No GitOps Syncs"
			actions={actions}
			createTitle="Create GitOps Sync"
			createFields={gitOpsSyncFields}
			createPath={syncsPath}
			edit={gitOpsSyncEditConfig}
			managementDestination={canManageRepositories ? 'gitRepositories' : undefined}
			openDetail={(item, onChange) =>
				nav.openSync({ resource: item.value, environmentID: item.environmentID, onChange })
			}
		/>
	);
}

/**
 * `appTabDestination(.gitOps)`: the active environment's syncs, or every
 * enabled environment's with the All Environments preview. Re-keyed on the
 * environment so switching starts a fresh list.
 */
export function GitOpsDestination() {
	const environmentID = useClientManager((s) => s.activeEnvironmentID);
	const allEnvironments = useClientManager((s) => s.allEnvironmentsPreview);
	return (
		<GitOpsSyncsView
			key={`${environmentID}|${allEnvironments}`}
			environmentID={environmentID}
			allEnvironments={allEnvironments}
		/>
	);
}
