/** Port of Services/SwarmService.swift and Services/SwarmService+Nodes.swift. */
import type { EnvironmentID } from '../client/environment';
import { boolString, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { ArcaneRequestOptions } from '../http/requestOptions';
import { decodeArray } from '../models/base/decoding';
import { MessageResponse } from '../models/base/message';
import type { SortOrder } from '../models/base/pagination';
import type {
	SwarmConfigCreateRequest,
	SwarmConfigSummary,
	SwarmConfigUpdateRequest
} from '../models/swarm/SwarmConfig';
import type { SwarmInfo, SwarmRuntimeStatus } from '../models/swarm/SwarmInfo';
import type {
	SwarmInitRequest,
	SwarmInitResponse,
	SwarmJoinRequest,
	SwarmJoinTokens,
	SwarmLeaveRequest,
	SwarmRotateJoinTokensRequest,
	SwarmUnlockKeyResponse,
	SwarmUnlockRequest,
	SwarmUpdateRequest
} from '../models/swarm/SwarmJoinTokens';
import {
	SwarmJoinCandidate,
	SwarmJoinEnvironmentsRequest,
	SwarmJoinEnvironmentsResponse,
	SwarmNodeAgentBindingRequest,
	SwarmNodeAgentReconcileResponse
} from '../models/swarm/SwarmLifecycle';
import {
	SwarmNode,
	SwarmNodeAgentDeployment,
	type SwarmNodeAgentDeploymentRequest,
	type SwarmNodeIdentity,
	type SwarmNodeUpdateRequest
} from '../models/swarm/SwarmNode';
import type {
	SwarmSecretCreateRequest,
	SwarmSecretSummary,
	SwarmSecretUpdateRequest
} from '../models/swarm/SwarmSecret';
import {
	SwarmServiceInspect,
	SwarmServiceSummary,
	type SwarmServiceCreateRequest,
	type SwarmServiceCreateResponse,
	type SwarmServiceScaleRequest,
	type SwarmServiceUpdateRequest,
	type SwarmServiceUpdateResponse
} from '../models/swarm/SwarmServices';
import type {
	SwarmStackDeployRequest,
	SwarmStackDeployResponse,
	SwarmStackInspect,
	SwarmStackRenderConfigRequest,
	SwarmStackRenderConfigResponse,
	SwarmStackSource,
	SwarmStackSourceUpdateRequest,
	SwarmStackSummary
} from '../models/swarm/SwarmStack';
import type { SwarmTaskSummary } from '../models/swarm/SwarmTask';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';
import { LogStream } from '../streaming/Streams';

/** Shared list arguments (Swift `envID:search:sort:order:start:limit:`). */
export interface SwarmListArgs {
	envID?: EnvironmentID;
	search?: string;
	sort?: string;
	order?: SortOrder;
	/** Default `0`. */
	start?: number;
	/** Default `20`. */
	limit?: number;
}

/**
 * Facade for the Docker Swarm endpoints under `/environments/{id}/swarm`.
 *
 * This class collides on name with the Docker concept of a "swarm service"
 * (a deployed service object), which is modeled as `SwarmServiceSummary` /
 * `SwarmServiceInspect` to keep things unambiguous.
 */
export class SwarmService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - Status / Info / Spec

	/** Returns whether swarm mode is enabled in this environment. */
	status(args: { envID?: EnvironmentID } = {}): Promise<SwarmRuntimeStatus> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/status'));
	}

	/** Returns the top-level swarm metadata. */
	info(args: { envID?: EnvironmentID } = {}): Promise<SwarmInfo> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/info'));
	}

	/** Updates the swarm-level spec. */
	updateSpec(args: { request: SwarmUpdateRequest; envID?: EnvironmentID }): Promise<void> {
		return this.rest.putVoid(this.rest.environmentPath(args.envID, 'swarm/spec'), {
			body: args.request
		});
	}

	// MARK: - Lifecycle

	/** Initializes a brand-new swarm cluster on this environment's Docker engine. */
	initSwarm(args: {
		request: SwarmInitRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmInitResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/init'), {
			body: args.request
		});
	}

	/** Joins this environment's Docker engine to an existing swarm. */
	join(args: { request: SwarmJoinRequest; envID?: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'swarm/join'), {
			body: args.request
		});
	}

	/** Returns enabled environments that can be joined to this manager's swarm. */
	joinCandidates(args: { envID?: EnvironmentID } = {}): Promise<SwarmJoinCandidate[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/join-candidates'), {
			decode: decodeArray(SwarmJoinCandidate.decode)
		});
	}

	/** Joins one or more Arcane environments without exposing swarm join tokens. */
	joinEnvironments(args: {
		request: SwarmJoinEnvironmentsRequest;
		envID?: EnvironmentID;
		options?: ArcaneRequestOptions;
	}): Promise<SwarmJoinEnvironmentsResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/join-environments'), {
			body: SwarmJoinEnvironmentsRequest.encode(args.request),
			options: args.options,
			decode: SwarmJoinEnvironmentsResponse.decode
		});
	}

	/** Removes this environment's Docker engine from the swarm. */
	leave(args: { force?: boolean; envID?: EnvironmentID } = {}): Promise<void> {
		const body: SwarmLeaveRequest = { force: args.force ?? false };
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'swarm/leave'), { body });
	}

	/** Unlocks the swarm using the provided unlock key. */
	unlock(args: { key: string; envID?: EnvironmentID }): Promise<void> {
		const body: SwarmUnlockRequest = { key: args.key };
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'swarm/unlock'), { body });
	}

	/** Returns the swarm unlock key (requires admin). */
	unlockKey(args: { envID?: EnvironmentID } = {}): Promise<SwarmUnlockKeyResponse> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/unlock-key'));
	}

	/**
	 * Returns the local swarm node identity (used for cross-environment matching).
	 * This endpoint sits *outside* the environments tree.
	 */
	localNodeIdentity(): Promise<SwarmNodeIdentity> {
		return this.rest.get('swarm/node-identity');
	}

	// MARK: - Join tokens

	/** Returns the worker / manager join tokens for the swarm. */
	joinTokens(args: { envID?: EnvironmentID } = {}): Promise<SwarmJoinTokens> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/join-tokens'));
	}

	/** Rotates the swarm join tokens. */
	rotateJoinTokens(args: {
		request: SwarmRotateJoinTokensRequest;
		envID?: EnvironmentID;
	}): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'swarm/join-tokens/rotate'), {
			body: args.request
		});
	}

	// MARK: - Services

	/** Lists swarm services with offset-based pagination. */
	listServices(args: SwarmListArgs = {}): Promise<PaginatedResponse<SwarmServiceSummary>> {
		return this.paginatedList('swarm/services', args, SwarmServiceSummary.decode);
	}

	/** Inspects a single swarm service. */
	service(args: { serviceId: string; envID?: EnvironmentID }): Promise<SwarmServiceInspect> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `swarm/services/${args.serviceId}`),
			{
				decode: SwarmServiceInspect.decode
			}
		);
	}

	/** Creates a new swarm service. */
	createService(args: {
		request: SwarmServiceCreateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmServiceCreateResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/services'), {
			body: args.request
		});
	}

	/** Updates an existing swarm service. */
	updateService(args: {
		serviceId: string;
		request: SwarmServiceUpdateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmServiceUpdateResponse> {
		return this.rest.put(
			this.rest.environmentPath(args.envID, `swarm/services/${args.serviceId}`),
			{
				body: args.request
			}
		);
	}

	/** Deletes a swarm service. */
	deleteService(args: { serviceId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `swarm/services/${args.serviceId}`)
		);
	}

	/** Lists the tasks belonging to a swarm service. */
	serviceTasks(
		args: { serviceId: string } & SwarmListArgs
	): Promise<PaginatedResponse<SwarmTaskSummary>> {
		return this.paginatedList(`swarm/services/${args.serviceId}/tasks`, args);
	}

	/** Rolls a swarm service back to its previous spec. */
	rollbackService(args: {
		serviceId: string;
		envID?: EnvironmentID;
	}): Promise<SwarmServiceUpdateResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `swarm/services/${args.serviceId}/rollback`)
		);
	}

	/** Scales a replicated swarm service. */
	scaleService(args: {
		serviceId: string;
		replicas: number;
		envID?: EnvironmentID;
	}): Promise<SwarmServiceUpdateResponse> {
		const body: SwarmServiceScaleRequest = { replicas: args.replicas };
		return this.rest.post(
			this.rest.environmentPath(args.envID, `swarm/services/${args.serviceId}/scale`),
			{ body }
		);
	}

	// MARK: - Stacks

	/** Lists stacks deployed to the swarm. */
	listStacks(args: SwarmListArgs = {}): Promise<PaginatedResponse<SwarmStackSummary>> {
		return this.paginatedList('swarm/stacks', args);
	}

	/** Deploys (creates or updates) a stack from a compose document. */
	deployStack(args: {
		request: SwarmStackDeployRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmStackDeployResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/stacks'), {
			body: args.request
		});
	}

	/** Inspects a single stack by name. */
	stack(args: { name: string; envID?: EnvironmentID }): Promise<SwarmStackInspect> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/stacks/${args.name}`));
	}

	/** Returns the persisted compose source for a stack. */
	stackSource(args: { name: string; envID?: EnvironmentID }): Promise<SwarmStackSource> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/stacks/${args.name}/source`));
	}

	/** Updates the persisted compose source for a stack. */
	updateStackSource(args: {
		name: string;
		request: SwarmStackSourceUpdateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmStackSource> {
		return this.rest.put(
			this.rest.environmentPath(args.envID, `swarm/stacks/${args.name}/source`),
			{
				body: args.request
			}
		);
	}

	/** Removes a deployed stack. */
	deleteStack(args: { name: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, `swarm/stacks/${args.name}`));
	}

	/** Lists the services that belong to a stack. */
	stackServices(
		args: { name: string } & SwarmListArgs
	): Promise<PaginatedResponse<SwarmServiceSummary>> {
		return this.paginatedList(
			`swarm/stacks/${args.name}/services`,
			args,
			SwarmServiceSummary.decode
		);
	}

	/** Lists the tasks that belong to a stack. */
	stackTasks(args: { name: string } & SwarmListArgs): Promise<PaginatedResponse<SwarmTaskSummary>> {
		return this.paginatedList(`swarm/stacks/${args.name}/tasks`, args);
	}

	/** Renders / validates a compose document without deploying it. */
	renderStackConfig(args: {
		request: SwarmStackRenderConfigRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmStackRenderConfigResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/stacks/config/render'), {
			body: args.request
		});
	}

	// MARK: - Configs

	/** Lists swarm configs. */
	listConfigs(args: { envID?: EnvironmentID } = {}): Promise<SwarmConfigSummary[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/configs'));
	}

	/** Inspects a single swarm config. */
	config(args: { configId: string; envID?: EnvironmentID }): Promise<SwarmConfigSummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/configs/${args.configId}`));
	}

	/** Creates a new swarm config. */
	createConfig(args: {
		request: SwarmConfigCreateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmConfigSummary> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/configs'), {
			body: args.request
		});
	}

	/** Updates a swarm config. */
	updateConfig(args: {
		configId: string;
		request: SwarmConfigUpdateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmConfigSummary> {
		return this.rest.put(this.rest.environmentPath(args.envID, `swarm/configs/${args.configId}`), {
			body: args.request
		});
	}

	/** Deletes a swarm config. */
	deleteConfig(args: { configId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `swarm/configs/${args.configId}`)
		);
	}

	// MARK: - Secrets

	/** Lists swarm secrets. */
	listSecrets(args: { envID?: EnvironmentID } = {}): Promise<SwarmSecretSummary[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/secrets'));
	}

	/** Inspects a single swarm secret. */
	secret(args: { secretId: string; envID?: EnvironmentID }): Promise<SwarmSecretSummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/secrets/${args.secretId}`));
	}

	/** Creates a new swarm secret. */
	createSecret(args: {
		request: SwarmSecretCreateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmSecretSummary> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/secrets'), {
			body: args.request
		});
	}

	/** Updates a swarm secret. */
	updateSecret(args: {
		secretId: string;
		request: SwarmSecretUpdateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmSecretSummary> {
		return this.rest.put(this.rest.environmentPath(args.envID, `swarm/secrets/${args.secretId}`), {
			body: args.request
		});
	}

	/** Deletes a swarm secret. */
	deleteSecret(args: { secretId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `swarm/secrets/${args.secretId}`)
		);
	}

	// MARK: - WebSocket streams

	/** Streams logs for a swarm service over a WebSocket connection. */
	serviceLogs(args: {
		serviceId: string;
		envID?: EnvironmentID;
		/** Default `true`. */
		follow?: boolean;
		/** Default `"100"`. */
		tail?: string;
		since?: string;
		/** Default `false`. */
		timestamps?: boolean;
	}): LogStream {
		const env = args.envID ?? this.rest.defaultEnvironmentID;
		const query: QueryItem[] = [
			{ name: 'follow', value: boolString(args.follow ?? true) },
			{ name: 'tail', value: args.tail ?? '100' },
			{ name: 'timestamps', value: boolString(args.timestamps ?? false) }
		];
		if (args.since !== undefined) query.push({ name: 'since', value: args.since });
		return new LogStream(
			this.rest.transport,
			`environments/${env}/ws/swarm/services/${args.serviceId}/logs`,
			query
		);
	}

	// MARK: - Nodes

	/** Lists swarm nodes. */
	listNodes(args: SwarmListArgs = {}): Promise<PaginatedResponse<SwarmNode>> {
		return this.paginatedList('swarm/nodes', args, SwarmNode.decode);
	}

	/** Returns a single swarm node. */
	node(args: { nodeId: string; envID?: EnvironmentID }): Promise<SwarmNode> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}`), {
			decode: SwarmNode.decode
		});
	}

	/** Returns the node-agent deployment snippets for a swarm node. */
	nodeAgentDeployment(args: {
		nodeId: string;
		/** Default `false`. */
		rotate?: boolean;
		envID?: EnvironmentID;
	}): Promise<SwarmNodeAgentDeployment> {
		const body: SwarmNodeAgentDeploymentRequest = { rotate: args.rotate ?? false };
		return this.rest.post(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}/agent/deployment`),
			{ body, decode: SwarmNodeAgentDeployment.decode }
		);
	}

	/** Reconciles visible Arcane environment bindings for every node in a swarm. */
	reconcileNodeAgents(
		args: { envID?: EnvironmentID; options?: ArcaneRequestOptions } = {}
	): Promise<SwarmNodeAgentReconcileResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/nodes/agents/reconcile'), {
			body: {},
			options: args.options,
			decode: SwarmNodeAgentReconcileResponse.decode
		});
	}

	/** Attaches an existing Arcane environment to a swarm node. */
	bindNodeAgent(args: {
		nodeId: string;
		request: SwarmNodeAgentBindingRequest;
		envID?: EnvironmentID;
		options?: ArcaneRequestOptions;
	}): Promise<SwarmNode> {
		return this.rest.put(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}/agent/binding`),
			{
				body: SwarmNodeAgentBindingRequest.encode(args.request),
				options: args.options,
				decode: SwarmNode.decode
			}
		);
	}

	/** Detaches the visible environment currently bound to a swarm node. */
	detachNodeAgent(args: {
		nodeId: string;
		envID?: EnvironmentID;
		options?: ArcaneRequestOptions;
	}): Promise<MessageResponse> {
		return this.rest.delete(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}/agent/binding`),
			{ options: args.options, decode: MessageResponse.decode }
		);
	}

	/** Removes a dedicated hidden node-agent registration. */
	removeNodeAgentDeployment(args: {
		nodeId: string;
		envID?: EnvironmentID;
		options?: ArcaneRequestOptions;
	}): Promise<MessageResponse> {
		return this.rest.delete(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}/agent/deployment`),
			{ options: args.options, decode: MessageResponse.decode }
		);
	}

	/** Updates a swarm node (labels / role / availability). */
	async updateNode(args: {
		nodeId: string;
		request: SwarmNodeUpdateRequest;
		envID?: EnvironmentID;
	}): Promise<void> {
		await this.rest.patch(this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}`), {
			body: args.request,
			decode: MessageResponse.decode
		});
	}

	/** Deletes a swarm node, optionally forcing removal. */
	deleteNode(args: { nodeId: string; force?: boolean; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}`),
			{
				query: [{ name: 'force', value: boolString(args.force ?? false) }]
			}
		);
	}

	/** Promotes a worker to manager. */
	promoteNode(args: { nodeId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}/promote`)
		);
	}

	/** Demotes a manager to worker. */
	demoteNode(args: { nodeId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}/demote`)
		);
	}

	/** Lists tasks running on a swarm node. */
	nodeTasks(
		args: { nodeId: string } & SwarmListArgs
	): Promise<PaginatedResponse<SwarmTaskSummary>> {
		return this.paginatedList(`swarm/nodes/${args.nodeId}/tasks`, args);
	}

	// MARK: - Tasks

	/** Lists every task in the swarm. */
	listTasks(args: SwarmListArgs = {}): Promise<PaginatedResponse<SwarmTaskSummary>> {
		return this.paginatedList('swarm/tasks', args);
	}

	// MARK: - Helpers

	/** Swift `Self.startLimitQuery(search:sort:order:start:limit:)` (start/limit are appended by the transport). */
	static startLimitQuery(args: {
		search?: string;
		sort?: string;
		order?: SortOrder;
		start: number;
		limit: number;
	}): QueryItem[] {
		const items: QueryItem[] = [];
		if (args.search !== undefined) items.push({ name: 'search', value: args.search });
		if (args.sort !== undefined) items.push({ name: 'sort', value: args.sort });
		if (args.order !== undefined) items.push({ name: 'order', value: args.order });
		return items;
	}

	private paginatedList<T>(
		suffix: string,
		args: SwarmListArgs,
		decode?: (raw: unknown) => T
	): Promise<PaginatedResponse<T>> {
		const start = args.start ?? 0;
		const limit = args.limit ?? 20;
		return this.rest.transport.paginated<T>(this.rest.environmentPath(args.envID, suffix), {
			start,
			limit,
			query: SwarmService.startLimitQuery({
				search: args.search,
				sort: args.sort,
				order: args.order,
				start,
				limit
			}),
			decode
		});
	}
}
