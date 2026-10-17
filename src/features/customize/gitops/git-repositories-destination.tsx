import {
	backendFormField,
	backendListAction,
	dynamicEditConfig,
	type BackendFormField
} from '../dynamic-resources/dynamic-resource';
import { DynamicResourceListView } from '../dynamic-resources/dynamic-resource-list-screen';

const fields: BackendFormField[] = [
	backendFormField('name', 'Name', { required: true }),
	backendFormField('url', 'URL', {
		required: true,
		placeholder: 'https://github.com/org/repo.git'
	}),
	backendFormField('authType', 'Authentication', {
		type: { kind: 'choice', options: ['none', 'http', 'ssh'] }
	}),
	backendFormField('username', 'Username'),
	backendFormField('token', 'Token', { type: { kind: 'secure' } }),
	backendFormField('sshKey', 'SSH Key', { type: { kind: 'multiline' } }),
	backendFormField('description', 'Description')
];

const actions = [
	backendListAction({
		id: 'test',
		title: 'Test Connection',
		systemImage: 'checkmark.seal',
		method: 'POST',
		pathSuffix: '/{id}/test'
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

const editConfig = dynamicEditConfig('Edit Git Repository', fields);

const repositoriesPath = () => 'customize/git-repositories';

export function GitRepositoriesDestination() {
	return (
		<DynamicResourceListView
			title="Git Repositories"
			systemImage="arrow.triangle.branch"
			path={repositoriesPath}
			emptyTitle="No Git Repositories"
			actions={actions}
			createTitle="Add Git Repository"
			createFields={fields}
			createPath={repositoriesPath}
			edit={editConfig}
		/>
	);
}
