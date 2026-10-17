export const Permission = {
	sudo: '*',

	Containers: {
		list: 'containers:list',
		read: 'containers:read',
		logs: 'containers:logs',
		edit: 'containers:edit',
		create: 'containers:create',
		start: 'containers:start',
		stop: 'containers:stop',
		restart: 'containers:restart',
		redeploy: 'containers:redeploy',
		delete: 'containers:delete',
		exec: 'containers:exec',
		autoUpdate: 'containers:autoupdate'
	},

	Projects: {
		list: 'projects:list',
		read: 'projects:read',
		logs: 'projects:logs',
		create: 'projects:create',
		update: 'projects:update',
		deploy: 'projects:deploy',
		down: 'projects:down',
		restart: 'projects:restart',
		delete: 'projects:delete',
		archive: 'projects:archive'
	},

	Images: {
		list: 'images:list',
		read: 'images:read',
		pull: 'images:pull',
		push: 'images:push',
		tag: 'images:tag',
		commit: 'images:commit',
		patch: 'images:patch',
		build: 'images:build',
		prune: 'images:prune',
		delete: 'images:delete',
		upload: 'images:upload'
	},

	Volumes: {
		list: 'volumes:list',
		read: 'volumes:read',
		create: 'volumes:create',
		delete: 'volumes:delete',
		prune: 'volumes:prune',
		browse: 'volumes:browse',
		upload: 'volumes:upload',
		backup: 'volumes:backup'
	},

	Networks: {
		list: 'networks:list',
		read: 'networks:read',
		create: 'networks:create',
		delete: 'networks:delete',
		prune: 'networks:prune'
	},

	Swarm: {
		read: 'swarm:read',
		initialize: 'swarm:init',
		join: 'swarm:join',
		leave: 'swarm:leave',
		spec: 'swarm:spec',
		nodes: 'swarm:nodes',
		services: 'swarm:services',
		servicesLogs: 'swarm:services:logs',
		stacks: 'swarm:stacks',
		configs: 'swarm:configs',
		secrets: 'swarm:secrets',
		unlock: 'swarm:unlock'
	},

	Users: {
		list: 'users:list',
		read: 'users:read',
		create: 'users:create',
		update: 'users:update',
		delete: 'users:delete'
	},

	Roles: {
		list: 'roles:list',
		read: 'roles:read'
	},

	ApiKeys: {
		list: 'apikeys:list',
		read: 'apikeys:read',
		create: 'apikeys:create',
		update: 'apikeys:update',
		delete: 'apikeys:delete'
	},

	Settings: {
		read: 'settings:read',
		write: 'settings:write'
	},

	Environments: {
		list: 'environments:list',
		read: 'environments:read',
		create: 'environments:create',
		update: 'environments:update',
		delete: 'environments:delete',
		pair: 'environments:pair',
		sync: 'environments:sync'
	},

	Registries: {
		list: 'registries:list',
		read: 'registries:read',
		create: 'registries:create',
		update: 'registries:update',
		delete: 'registries:delete',
		test: 'registries:test'
	},

	Templates: {
		list: 'templates:list',
		read: 'templates:read',
		create: 'templates:create',
		update: 'templates:update',
		delete: 'templates:delete'
	},

	Variables: {
		read: 'variables:read',
		create: 'variables:create',
		update: 'variables:update',
		delete: 'variables:delete',
		sync: 'variables:sync'
	},

	GitRepositories: {
		list: 'git-repositories:list',
		read: 'git-repositories:read',
		create: 'git-repositories:create',
		update: 'git-repositories:update',
		delete: 'git-repositories:delete',
		test: 'git-repositories:test',
		sync: 'git-repositories:sync'
	},

	GitOps: {
		list: 'gitops:list',
		read: 'gitops:read',
		create: 'gitops:create',
		update: 'gitops:update',
		delete: 'gitops:delete',
		sync: 'gitops:sync'
	},

	Webhooks: {
		list: 'webhooks:list',
		create: 'webhooks:create',
		update: 'webhooks:update',
		delete: 'webhooks:delete'
	},

	System: {
		read: 'system:read',
		prune: 'system:prune',
		upgrade: 'system:upgrade'
	},

	Vulnerabilities: {
		read: 'vulnerabilities:read',
		scan: 'vulnerabilities:scan',
		manage: 'vulnerabilities:manage'
	},

	ImageUpdates: {
		read: 'image-updates:read',
		check: 'image-updates:check'
	},

	Events: {
		read: 'events:read',
		delete: 'events:delete'
	},

	Dashboard: {
		read: 'dashboard:read'
	},

	Jobs: {
		manage: 'jobs:manage'
	},

	Notifications: {
		manage: 'notifications:manage'
	},

	Customize: {
		manage: 'customize:manage'
	},

	BuildWorkspaces: {
		manage: 'build-workspaces:manage'
	}
} as const;
