import type { QueryItem } from './url';

export interface APIRoute {
	method: string;
	path: string;
	query: QueryItem[];
}

interface RouteTarget {
	method?: string;
	path: string;
	action?: string;
	global?: boolean;
}

interface RouteRule {
	methods: readonly string[] | undefined;
	pattern: RegExp;
	target: (match: RegExpExecArray) => RouteTarget;
}

const ANY = undefined;
const POST = ['POST'] as const;
const PUT = ['PUT'] as const;
const GET = ['GET'] as const;
const DELETE = ['DELETE'] as const;

function rule(
	methods: readonly string[] | undefined,
	pattern: RegExp,
	target: (match: RegExpExecArray) => RouteTarget
): RouteRule {
	return { methods, pattern, target };
}

function g(match: RegExpExecArray, index: number): string {
	return match[index] ?? '';
}

const ACTION_ALIASES: Record<string, string> = {
	'restore-files': 'restorefiles',
	'start-all': 'startall',
	'start-stopped': 'startstopped',
	'stop-all': 'stopall',
	'update-services': 'updateservices'
};

function actionName(value: string): string {
	return ACTION_ALIASES[value] ?? value;
}

const GLOBAL_RULES: readonly RouteRule[] = [
	rule(GET, /^app-version$/, () => ({ path: 'app/version' })),
	rule(ANY, /^app-images\/(.+)$/, (m) => ({ path: `app/images/${g(m, 1)}` })),
	rule(ANY, /^edge-mtls\/ca$/, () => ({ path: 'agent/mtls/ca' })),
	rule(POST, /^auth\/sessions\/logout-all$/, () => ({ method: 'DELETE', path: 'auth/sessions' })),
	rule(POST, /^auth\/me\/mfa\/recovery-codes\/regenerate$/, () => ({
		path: 'auth/me/mfa/recovery',
		action: 'regenerate'
	})),
	rule(PUT, /^auth\/me\/(profile|passkeys\/[^/]+)$/, (m) => ({
		method: 'PATCH',
		path: `auth/me/${g(m, 1)}`
	})),
	rule(ANY, /^auth\/me\/api-keys(\/.*)?$/, (m) => ({ path: `auth/me/apikeys${g(m, 1)}` })),
	rule(PUT, /^api-keys\/([^/]+)$/, (m) => ({ method: 'PATCH', path: `apikeys/${g(m, 1)}` })),
	rule(ANY, /^api-keys(\/.*)?$/, (m) => ({ path: `apikeys${g(m, 1)}` })),
	rule(POST, /^apns\/pairing-token$/, () => ({ path: 'apns/pairing' })),
	rule(POST, /^apns\/devices\/([^/]+)\/test$/, (m) => ({
		path: `apns/devices/${g(m, 1)}`,
		action: 'test'
	})),
	rule(GET, /^backups\/s3\/([^/]+)\/in-use$/, (m) => ({ path: `backups/s3/${g(m, 1)}/usage` })),
	rule(POST, /^backups\/s3\/([^/]+)\/test$/, (m) => ({
		path: `backups/s3/${g(m, 1)}`,
		action: 'test'
	})),
	rule(PUT, /^backups\/s3\/([^/]+)$/, (m) => ({ method: 'PATCH', path: `backups/s3/${g(m, 1)}` })),
	rule(POST, /^backups\/recovery-key\/generate$/, () => ({
		path: 'backups/recovery/key',
		action: 'generate'
	})),
	rule(ANY, /^backups\/recovery-key$/, () => ({ path: 'backups/recovery/key' })),
	rule(POST, /^backups\/([^/]+)\/(restore|restore-files)$/, (m) => ({
		path: `backups/${g(m, 1)}`,
		action: actionName(g(m, 2))
	})),
	rule(GET, /^container-registries\/pull-usage$/, () => ({ path: 'registries/usage' })),
	rule(POST, /^container-registries\/([^/]+)\/test$/, (m) => ({
		path: `registries/${g(m, 1)}`,
		action: 'test'
	})),
	rule(PUT, /^container-registries\/([^/]+)$/, (m) => ({
		method: 'PATCH',
		path: `registries/${g(m, 1)}`
	})),
	rule(ANY, /^container-registries(\/.*)?$/, (m) => ({ path: `registries${g(m, 1)}` })),
	rule(POST, /^customize\/git-repositories\/([^/]+)\/test$/, (m) => ({
		path: `customize/git/repositories/${g(m, 1)}`,
		action: 'test'
	})),
	rule(PUT, /^customize\/git-repositories\/([^/]+)$/, (m) => ({
		method: 'PATCH',
		path: `customize/git/repositories/${g(m, 1)}`
	})),
	rule(ANY, /^customize\/git-repositories(\/.*)?$/, (m) => ({
		path: `customize/git/repositories${g(m, 1)}`
	})),
	rule(POST, /^git-repositories\/sync$/, () => ({ path: 'git/repositories/sync' })),
	rule(PUT, /^federated-credentials\/([^/]+)$/, (m) => ({
		method: 'PATCH',
		path: `federated/credentials/${g(m, 1)}`
	})),
	rule(ANY, /^federated-credentials(\/.*)?$/, (m) => ({ path: `federated/credentials${g(m, 1)}` })),
	rule(PUT, /^oidc\/role-mappings\/([^/]+)$/, (m) => ({
		method: 'PATCH',
		path: `oidc/mappings/${g(m, 1)}`
	})),
	rule(ANY, /^oidc\/role-mappings(\/.*)?$/, (m) => ({ path: `oidc/mappings${g(m, 1)}` })),
	rule(GET, /^roles\/available-permissions$/, () => ({ path: 'roles/permissions' })),
	rule(PUT, /^roles\/([^/]+)$/, (m) => ({ method: 'PATCH', path: `roles/${g(m, 1)}` })),
	rule(GET, /^swarm\/node-identity$/, () => ({ path: 'swarm/identity' })),
	rule(POST, /^templates\/([^/]+)\/download$/, (m) => ({
		path: `templates/${g(m, 1)}`,
		action: 'download'
	})),
	rule(PUT, /^templates\/(registries\/[^/]+|[^/]+)$/, (m) => ({
		method: 'PATCH',
		path: `templates/${g(m, 1)}`
	})),
	rule(ANY, /^users\/([^/]+)\/role-assignments$/, (m) => ({ path: `users/${g(m, 1)}/roles` })),
	rule(PUT, /^users\/([^/]+)$/, (m) => ({ method: 'PATCH', path: `users/${g(m, 1)}` })),
	rule(GET, /^variables\/sync-status$/, () => ({ path: 'variables/sync' })),
	rule(PUT, /^variables\/([^/]+)$/, (m) => ({ method: 'PATCH', path: `variables/${g(m, 1)}` })),
	rule(PUT, /^environments\/([^/]+)$/, (m) => ({
		method: 'PATCH',
		path: `environments/${g(m, 1)}`
	}))
];

const ENVIRONMENT_RULES: readonly RouteRule[] = [
	rule(POST, /^activities\/([^/]+)\/cancel$/, (m) => ({
		path: `activities/${g(m, 1)}`,
		action: 'cancel'
	})),
	rule(POST, /^containers\/generate-compose$/, () => ({ path: 'containers/compose' })),
	rule(POST, /^containers\/([^/]+)\/(start|stop|restart|kill|pause|unpause)$/, (m) => ({
		path: `containers/${g(m, 1)}`,
		action: g(m, 2)
	})),
	rule(GET, /^containers\/([^/]+)\/edit-config$/, (m) => ({
		path: `containers/${g(m, 1)}/config`
	})),
	rule(POST, /^containers\/([^/]+)\/edit$/, (m) => ({
		method: 'PUT',
		path: `containers/${g(m, 1)}/config`
	})),
	rule(PUT, /^containers\/([^/]+)\/auto-update$/, (m) => ({
		path: `containers/${g(m, 1)}/autoupdate`
	})),
	rule(POST, /^gitops-syncs\/([^/]+)\/sync$/, (m) => ({
		path: `gitops/syncs/${g(m, 1)}`,
		action: 'sync'
	})),
	rule(PUT, /^gitops-syncs\/([^/]+)$/, (m) => ({
		method: 'PATCH',
		path: `gitops/syncs/${g(m, 1)}`
	})),
	rule(ANY, /^gitops-syncs(\/.*)?$/, (m) => ({ path: `gitops/syncs${g(m, 1)}` })),
	rule(POST, /^image-updates\/check-all$/, () => ({ path: 'images/updates/check', action: 'all' })),
	rule(POST, /^image-updates\/check-batch$/, () => ({
		path: 'images/updates/check',
		action: 'batch'
	})),
	rule(GET, /^image-updates\/by-refs$/, () => ({ path: 'images/updates/refs' })),
	rule(ANY, /^image-updates\/(check|summary)(\/.*)?$/, (m) => ({
		path: `images/updates/${g(m, 1)}${g(m, 2)}`
	})),
	rule(GET, /^images\/patch-targets$/, () => ({ path: 'images/patches/targets' })),
	rule(GET, /^job-schedules$/, () => ({ path: 'jobs/schedules' })),
	rule(PUT, /^job-schedules$/, () => ({ method: 'PATCH', path: 'jobs/schedules' })),
	rule(POST, /^jobs\/([^/]+)\/(run|restart)$/, (m) => ({
		path: `jobs/${g(m, 1)}`,
		action: g(m, 2)
	})),
	rule(POST, /^jobs\/([^/]+)\/runs\/([^/]+)\/(cancel|retry|ack)$/, (m) => ({
		path: `jobs/${g(m, 1)}/runs/${g(m, 2)}`,
		action: g(m, 3)
	})),
	rule(POST, /^networks\/([^/]+)\/(connect|disconnect)$/, (m) => ({
		path: `networks/${g(m, 1)}`,
		action: g(m, 2)
	})),
	rule(POST, /^notifications\/test\/([^/]+)$/, (m) => ({
		path: `notifications/settings/${g(m, 1)}`,
		action: 'test',
		global: true
	})),
	rule(ANY, /^notifications\/settings(\/.*)?$/, (m) => ({
		path: `notifications/settings${g(m, 1)}`,
		global: true
	})),
	rule(POST, /^podman\/pods\/([^/]+)\/(start|stop|restart|pause|unpause|kill)$/, (m) => ({
		path: `podman/pods/${g(m, 1)}`,
		action: g(m, 2)
	})),
	rule(POST, /^podman\/quadlets\/([^/]+)\/(start|stop|restart)$/, (m) => ({
		path: `podman/quadlets/${g(m, 1)}`,
		action: g(m, 2)
	})),
	rule(DELETE, /^projects\/([^/]+)\/destroy$/, (m) => ({ path: `projects/${g(m, 1)}` })),
	rule(POST, /^projects\/([^/]+)\/(up|redeploy|pull)$/, (m) => ({
		path: `projects/${g(m, 1)}/deploy`,
		action: g(m, 2)
	})),
	rule(POST, /^projects\/([^/]+)\/(down|restart|archive|unarchive|update-services)$/, (m) => ({
		path: `projects/${g(m, 1)}`,
		action: actionName(g(m, 2))
	})),
	rule(PUT, /^projects\/([^/]+)(\/workspace)?$/, (m) => ({
		method: 'PATCH',
		path: `projects/${g(m, 1)}${g(m, 2)}`
	})),
	rule(PUT, /^settings$/, () => ({ method: 'PATCH', path: 'settings' })),
	rule(GET, /^swarm\/join-candidates$/, () => ({ path: 'swarm/join/candidates' })),
	rule(GET, /^swarm\/join-tokens$/, () => ({ path: 'swarm/join/tokens' })),
	rule(POST, /^swarm\/join-tokens\/rotate$/, () => ({
		path: 'swarm/join/tokens',
		action: 'rotate'
	})),
	rule(POST, /^swarm\/join-environments$/, () => ({ path: 'swarm/join/environments' })),
	rule(GET, /^swarm\/unlock-key$/, () => ({ path: 'swarm/unlock/key' })),
	rule(POST, /^swarm\/nodes\/([^/]+)\/(promote|demote)$/, (m) => ({
		path: `swarm/nodes/${g(m, 1)}`,
		action: g(m, 2)
	})),
	rule(POST, /^swarm\/services\/([^/]+)\/rollback$/, (m) => ({
		path: `swarm/services/${g(m, 1)}`,
		action: 'rollback'
	})),
	rule(POST, /^swarm\/services\/([^/]+)\/scale$/, (m) => ({
		method: 'PATCH',
		path: `swarm/services/${g(m, 1)}`
	})),
	rule(PUT, /^swarm\/stacks\/([^/]+)\/source$/, (m) => ({
		method: 'PATCH',
		path: `swarm/stacks/${g(m, 1)}/source`
	})),
	rule(POST, /^system\/containers\/(start-all|start-stopped|stop-all)$/, (m) => ({
		path: 'system/containers',
		action: actionName(g(m, 1))
	})),
	rule(POST, /^system\/upgrade\/all$/, () => ({ path: 'system/upgrade/jobs' })),
	rule(GET, /^system\/upgrade\/all\/status$/, () => ({ path: 'system/upgrade/jobs/current' })),
	rule(GET, /^volumes\/backups\/([^/]+)\/has-path$/, (m) => ({
		path: `volumes/backups/${g(m, 1)}/files/exists`
	})),
	rule(ANY, /^volumes\/([^/]+)\/backup-policy$/, (m) => ({
		path: `volumes/${g(m, 1)}/backups/policy`
	})),
	rule(POST, /^volumes\/([^/]+)\/backups\/([^/]+)\/(restore|restore-files)$/, (m) => ({
		path: `volumes/${g(m, 1)}/backups/${g(m, 2)}`,
		action: actionName(g(m, 3))
	})),
	rule(PUT, /^volumes\/([^/]+)\/workspace$/, (m) => ({
		method: 'PATCH',
		path: `volumes/${g(m, 1)}/workspace`
	})),
	rule(GET, /^vulnerabilities\/image-options$/, () => ({ path: 'vulnerabilities/images' })),
	rule(GET, /^vulnerabilities\/scanner-status$/, () => ({ path: 'vulnerabilities/scanner' })),
	rule(POST, /^vulnerabilities\/(ignore|unignore)\/bulk$/, (m) => ({
		path: 'vulnerabilities/ignored/bulk',
		action: g(m, 1)
	})),
	rule(POST, /^vulnerabilities\/ignore$/, () => ({ path: 'vulnerabilities/ignored' })),
	rule(DELETE, /^vulnerabilities\/ignore\/([^/]+)$/, (m) => ({
		path: `vulnerabilities/ignored/${g(m, 1)}`
	}))
];

const ENVIRONMENT_PATH = /^environments\/([^/]+)\/(.+)$/;

const TOTAL_COUNT_PATHS: readonly RegExp[] = [
	/^backups(\/history)?$/,
	/^events(\/environment\/[^/]+)?$/,
	/^environments\/[^/]+\/(activities|images\/builds|images\/patches|volumes\/[^/]+\/backups)$/
];

function withTotals(route: APIRoute): APIRoute {
	if (route.method !== 'GET') return route;
	const path = route.path.replace(/^\/+/, '').replace(/\/+$/, '');
	if (!TOTAL_COUNT_PATHS.some((pattern) => pattern.test(path))) return route;
	if (route.query.some((item) => item.name === 'includeTotal')) return route;
	return { ...route, query: [...route.query, { name: 'includeTotal', value: 'true' }] };
}

function applyRules(
	rules: readonly RouteRule[],
	method: string,
	path: string
): RouteTarget | undefined {
	for (const candidate of rules) {
		if (candidate.methods !== undefined && !candidate.methods.includes(method)) continue;
		const match = candidate.pattern.exec(path);
		if (match) return candidate.target(match);
	}
	return undefined;
}

function withAction(query: QueryItem[], action: string | undefined): QueryItem[] {
	if (action === undefined) return query;
	return [{ name: 'action', value: action }, ...query.filter((item) => item.name !== 'action')];
}

function translateRoute(route: APIRoute): APIRoute {
	const method = route.method.toUpperCase();
	const path = route.path.replace(/^\/+/, '').replace(/\/+$/, '');
	const scoped = ENVIRONMENT_PATH.exec(path);
	if (scoped) {
		const environmentID = g(scoped, 1);
		const target = applyRules(ENVIRONMENT_RULES, method, g(scoped, 2));
		if (target) {
			return {
				method: target.method ?? method,
				path: target.global ? target.path : `environments/${environmentID}/${target.path}`,
				query: withAction(route.query, target.action)
			};
		}
	}
	const target = applyRules(GLOBAL_RULES, method, path);
	if (!target) return { method, path: route.path, query: route.query };
	return {
		method: target.method ?? method,
		path: target.path,
		query: withAction(route.query, target.action)
	};
}

export function translateRouteForV3(route: APIRoute): APIRoute {
	return withTotals(translateRoute(route));
}
