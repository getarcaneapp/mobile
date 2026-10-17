import { AuthManager } from '../auth/AuthManager';
import { AuthService } from '../auth/AuthService';
import { InMemoryTokenStore, type TokenStore } from '../auth/TokenStore';
import type { FetchLike } from '../http/fetching';
import type { ArcaneRequestOptions } from '../http/requestOptions';
import { RESTService } from '../http/RESTService';
import type { WebSocketStreamConfig } from '../streaming/Streams';
import type { ArcaneProxySession } from '../types/proxySession';
import { ActivitiesService } from '../services/ActivitiesService';
import { APIKeysService } from '../services/APIKeysService';
import { BuildsService } from '../services/BuildsService';
import { ContainerRegistriesService } from '../services/ContainerRegistriesService';
import { ContainersService } from '../services/ContainersService';
import { DashboardService } from '../services/DashboardService';
import { EnvironmentsService } from '../services/EnvironmentsService';
import { EventsService } from '../services/EventsService';
import { FederatedCredentialsService } from '../services/FederatedCredentialsService';
import { GitOpsService } from '../services/GitOpsService';
import { ImagesService } from '../services/ImagesService';
import { JobsService } from '../services/JobsService';
import { MobilePushService } from '../services/MobilePushService';
import { NetworksService } from '../services/NetworksService';
import { NotificationsService } from '../services/NotificationsService';
import { OidcRoleMappingsService } from '../services/OidcRoleMappingsService';
import { PasskeysService } from '../services/PasskeysService';
import { PortsService } from '../services/PortsService';
import { ProjectsService } from '../services/ProjectsService';
import { RolesService } from '../services/RolesService';
import { S3DestinationsService } from '../services/S3DestinationsService';
import { SettingsService } from '../services/SettingsService';
import { SwarmService } from '../services/SwarmService';
import { SystemBackupsService } from '../services/SystemBackupsService';
import { SystemService } from '../services/SystemService';
import { TemplatesService } from '../services/TemplatesService';
import { UpdaterService } from '../services/UpdaterService';
import { UploadsService } from '../services/UploadsService';
import { UsersService } from '../services/UsersService';
import { VariablesService } from '../services/VariablesService';
import { VersionService } from '../services/VersionService';
import { VolumesService } from '../services/VolumesService';
import { VulnerabilitiesService } from '../services/VulnerabilitiesService';
import { WebhooksService } from '../services/WebhooksService';
import { ArcaneTransport } from './ArcaneTransport';
import { EnvironmentID, RetryPolicy } from './environment';
import { expoStreamingFetch } from './expoStreamingFetch';
import type { ServerCapabilities } from './ServerCapabilities';

export interface ArcaneClientConfiguration {
	baseURL: string;
	tokenStore?: TokenStore;
	apiKey?: string;
	defaultEnvironmentID?: EnvironmentID;
	retryPolicy?: RetryPolicy;
	additionalHeaders?: Record<string, string>;
	proxySession?: ArcaneProxySession;
	timeoutMs?: number;
	fetch?: FetchLike;
	streamingFetch?: FetchLike;
	webSocket?: WebSocketStreamConfig;
}

interface ResolvedConfiguration extends ArcaneClientConfiguration {
	tokenStore: TokenStore;
	defaultEnvironmentID: EnvironmentID;
	retryPolicy: RetryPolicy;
}

const globalFetch: FetchLike = (input, init) =>
	(globalThis.fetch as unknown as FetchLike)(input, init);

export class ArcaneClient {
	readonly configuration: Readonly<ResolvedConfiguration>;
	readonly authManager: AuthManager;
	readonly transport: ArcaneTransport;
	readonly rest: RESTService;

	readonly auth: AuthService;
	readonly passkeys: PasskeysService;
	readonly users: UsersService;
	readonly systemBackups: SystemBackupsService;
	readonly s3Destinations: S3DestinationsService;
	readonly uploads: UploadsService;
	readonly federatedCredentials: FederatedCredentialsService;
	readonly apiKeys: APIKeysService;
	readonly roles: RolesService;
	readonly oidcRoleMappings: OidcRoleMappingsService;
	readonly environments: EnvironmentsService;
	readonly containers: ContainersService;
	readonly images: ImagesService;
	readonly volumes: VolumesService;
	readonly networks: NetworksService;
	readonly projects: ProjectsService;
	readonly swarm: SwarmService;
	readonly system: SystemService;
	readonly dashboard: DashboardService;
	readonly activities: ActivitiesService;
	readonly events: EventsService;
	readonly webhooks: WebhooksService;
	readonly notifications: NotificationsService;
	readonly templates: TemplatesService;
	readonly variables: VariablesService;
	readonly registries: ContainerRegistriesService;
	readonly gitops: GitOpsService;
	readonly builds: BuildsService;
	readonly jobs: JobsService;
	readonly settings: SettingsService;
	readonly updater: UpdaterService;
	readonly vulnerabilities: VulnerabilitiesService;
	readonly ports: PortsService;
	readonly version: VersionService;
	readonly mobilePush: MobilePushService;

	constructor(configuration: ArcaneClientConfiguration);
	constructor(
		configuration: ArcaneClientConfiguration,
		shared: { authManager: AuthManager; transport: ArcaneTransport }
	);
	constructor(
		configuration: ArcaneClientConfiguration,
		shared?: { authManager: AuthManager; transport: ArcaneTransport }
	) {
		const resolved: ResolvedConfiguration = {
			...configuration,
			tokenStore: configuration.tokenStore ?? new InMemoryTokenStore(),
			defaultEnvironmentID: configuration.defaultEnvironmentID ?? EnvironmentID.localDocker,
			retryPolicy: configuration.retryPolicy ?? RetryPolicy.default
		};
		this.configuration = resolved;
		const fetchImpl = resolved.fetch ?? globalFetch;
		this.authManager =
			shared?.authManager ??
			new AuthManager({
				baseURL: resolved.baseURL,
				tokenStore: resolved.tokenStore,
				apiKey: resolved.apiKey,
				fetch: fetchImpl,
				additionalHeaders: resolved.additionalHeaders,
				proxySession: resolved.proxySession,
				timeoutMs: resolved.timeoutMs
			});
		this.transport =
			shared?.transport ??
			new ArcaneTransport({
				baseURL: resolved.baseURL,
				authManager: this.authManager,
				fetch: fetchImpl,
				streamingFetch: resolved.streamingFetch ?? expoStreamingFetch,
				retryPolicy: resolved.retryPolicy,
				additionalHeaders: resolved.additionalHeaders,
				proxySession: resolved.proxySession,
				timeoutMs: resolved.timeoutMs,
				webSocket: resolved.webSocket
			});
		const rest = new RESTService(this.transport, resolved.defaultEnvironmentID);
		this.rest = rest;
		this.auth = new AuthService(this.transport, this.authManager);
		this.passkeys = new PasskeysService(rest, this.authManager);
		this.users = new UsersService(rest);
		this.systemBackups = new SystemBackupsService(rest);
		this.s3Destinations = new S3DestinationsService(rest);
		this.uploads = new UploadsService(rest);
		this.federatedCredentials = new FederatedCredentialsService(rest);
		this.apiKeys = new APIKeysService(rest);
		this.roles = new RolesService(rest);
		this.oidcRoleMappings = new OidcRoleMappingsService(rest);
		this.environments = new EnvironmentsService(rest);
		this.containers = new ContainersService(rest);
		this.images = new ImagesService(rest);
		this.volumes = new VolumesService(rest);
		this.networks = new NetworksService(rest);
		this.projects = new ProjectsService(rest);
		this.swarm = new SwarmService(rest);
		this.system = new SystemService(rest);
		this.dashboard = new DashboardService(rest);
		this.activities = new ActivitiesService(rest);
		this.events = new EventsService(rest);
		this.webhooks = new WebhooksService(rest);
		this.notifications = new NotificationsService(rest);
		this.templates = new TemplatesService(rest);
		this.variables = new VariablesService(rest);
		this.registries = new ContainerRegistriesService(rest);
		this.gitops = new GitOpsService(rest);
		this.builds = new BuildsService(rest);
		this.jobs = new JobsService(rest);
		this.settings = new SettingsService(rest);
		this.updater = new UpdaterService(rest);
		this.vulnerabilities = new VulnerabilitiesService(rest);
		this.ports = new PortsService(rest);
		this.version = new VersionService(rest);
		this.mobilePush = new MobilePushService(rest);
	}

	scoped(toEnvironment: EnvironmentID): ArcaneClient {
		return new ArcaneClient(
			{ ...this.configuration, defaultEnvironmentID: toEnvironment },
			{ authManager: this.authManager, transport: this.transport }
		);
	}

	withRequestOptions(options: ArcaneRequestOptions): ArcaneClient {
		return new ArcaneClient(this.configuration, {
			authManager: this.authManager,
			transport: this.transport.withRequestOptions(options)
		});
	}

	withSignal(signal: AbortSignal): ArcaneClient {
		return new ArcaneClient(this.configuration, {
			authManager: this.authManager,
			transport: this.transport.withSignal(signal)
		});
	}

	serverCapabilities(): ServerCapabilities {
		return this.authManager.currentCapabilities();
	}
}
