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

export interface SwarmListArgs {
	envID?: EnvironmentID;
	search?: string;
	sort?: string;
	order?: SortOrder;
	start?: number;
	limit?: number;
}

export class SwarmService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	status(args: { envID?: EnvironmentID } = {}): Promise<SwarmRuntimeStatus> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/status'));
	}

	info(args: { envID?: EnvironmentID } = {}): Promise<SwarmInfo> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/info'));
	}

	updateSpec(args: { request: SwarmUpdateRequest; envID?: EnvironmentID }): Promise<void> {
		return this.rest.putVoid(this.rest.environmentPath(args.envID, 'swarm/spec'), {
			body: args.request
		});
	}

	initSwarm(args: {
		request: SwarmInitRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmInitResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/init'), {
			body: args.request
		});
	}

	join(args: { request: SwarmJoinRequest; envID?: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'swarm/join'), {
			body: args.request
		});
	}

	joinCandidates(args: { envID?: EnvironmentID } = {}): Promise<SwarmJoinCandidate[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/join-candidates'), {
			decode: decodeArray(SwarmJoinCandidate.decode)
		});
	}

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

	leave(args: { force?: boolean; envID?: EnvironmentID } = {}): Promise<void> {
		const body: SwarmLeaveRequest = { force: args.force ?? false };
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'swarm/leave'), { body });
	}

	unlock(args: { key: string; envID?: EnvironmentID }): Promise<void> {
		const body: SwarmUnlockRequest = { key: args.key };
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'swarm/unlock'), { body });
	}

	unlockKey(args: { envID?: EnvironmentID } = {}): Promise<SwarmUnlockKeyResponse> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/unlock-key'));
	}

	localNodeIdentity(): Promise<SwarmNodeIdentity> {
		return this.rest.get('swarm/node-identity');
	}

	joinTokens(args: { envID?: EnvironmentID } = {}): Promise<SwarmJoinTokens> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/join-tokens'));
	}

	rotateJoinTokens(args: {
		request: SwarmRotateJoinTokensRequest;
		envID?: EnvironmentID;
	}): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'swarm/join-tokens/rotate'), {
			body: args.request
		});
	}

	listServices(args: SwarmListArgs = {}): Promise<PaginatedResponse<SwarmServiceSummary>> {
		return this.paginatedList('swarm/services', args, SwarmServiceSummary.decode);
	}

	service(args: { serviceId: string; envID?: EnvironmentID }): Promise<SwarmServiceInspect> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `swarm/services/${args.serviceId}`),
			{
				decode: SwarmServiceInspect.decode
			}
		);
	}

	createService(args: {
		request: SwarmServiceCreateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmServiceCreateResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/services'), {
			body: args.request
		});
	}

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

	deleteService(args: { serviceId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `swarm/services/${args.serviceId}`)
		);
	}

	serviceTasks(
		args: { serviceId: string } & SwarmListArgs
	): Promise<PaginatedResponse<SwarmTaskSummary>> {
		return this.paginatedList(`swarm/services/${args.serviceId}/tasks`, args);
	}

	rollbackService(args: {
		serviceId: string;
		envID?: EnvironmentID;
	}): Promise<SwarmServiceUpdateResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `swarm/services/${args.serviceId}/rollback`)
		);
	}

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

	listStacks(args: SwarmListArgs = {}): Promise<PaginatedResponse<SwarmStackSummary>> {
		return this.paginatedList('swarm/stacks', args);
	}

	deployStack(args: {
		request: SwarmStackDeployRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmStackDeployResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/stacks'), {
			body: args.request
		});
	}

	stack(args: { name: string; envID?: EnvironmentID }): Promise<SwarmStackInspect> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/stacks/${args.name}`));
	}

	stackSource(args: { name: string; envID?: EnvironmentID }): Promise<SwarmStackSource> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/stacks/${args.name}/source`));
	}

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

	deleteStack(args: { name: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, `swarm/stacks/${args.name}`));
	}

	stackServices(
		args: { name: string } & SwarmListArgs
	): Promise<PaginatedResponse<SwarmServiceSummary>> {
		return this.paginatedList(
			`swarm/stacks/${args.name}/services`,
			args,
			SwarmServiceSummary.decode
		);
	}

	stackTasks(args: { name: string } & SwarmListArgs): Promise<PaginatedResponse<SwarmTaskSummary>> {
		return this.paginatedList(`swarm/stacks/${args.name}/tasks`, args);
	}

	renderStackConfig(args: {
		request: SwarmStackRenderConfigRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmStackRenderConfigResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/stacks/config/render'), {
			body: args.request
		});
	}

	listConfigs(args: { envID?: EnvironmentID } = {}): Promise<SwarmConfigSummary[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/configs'));
	}

	config(args: { configId: string; envID?: EnvironmentID }): Promise<SwarmConfigSummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/configs/${args.configId}`));
	}

	createConfig(args: {
		request: SwarmConfigCreateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmConfigSummary> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/configs'), {
			body: args.request
		});
	}

	updateConfig(args: {
		configId: string;
		request: SwarmConfigUpdateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmConfigSummary> {
		return this.rest.put(this.rest.environmentPath(args.envID, `swarm/configs/${args.configId}`), {
			body: args.request
		});
	}

	deleteConfig(args: { configId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `swarm/configs/${args.configId}`)
		);
	}

	listSecrets(args: { envID?: EnvironmentID } = {}): Promise<SwarmSecretSummary[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'swarm/secrets'));
	}

	secret(args: { secretId: string; envID?: EnvironmentID }): Promise<SwarmSecretSummary> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/secrets/${args.secretId}`));
	}

	createSecret(args: {
		request: SwarmSecretCreateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmSecretSummary> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/secrets'), {
			body: args.request
		});
	}

	updateSecret(args: {
		secretId: string;
		request: SwarmSecretUpdateRequest;
		envID?: EnvironmentID;
	}): Promise<SwarmSecretSummary> {
		return this.rest.put(this.rest.environmentPath(args.envID, `swarm/secrets/${args.secretId}`), {
			body: args.request
		});
	}

	deleteSecret(args: { secretId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `swarm/secrets/${args.secretId}`)
		);
	}

	serviceLogs(args: {
		serviceId: string;
		envID?: EnvironmentID;
		follow?: boolean;
		tail?: string;
		since?: string;
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

	listNodes(args: SwarmListArgs = {}): Promise<PaginatedResponse<SwarmNode>> {
		return this.paginatedList('swarm/nodes', args, SwarmNode.decode);
	}

	node(args: { nodeId: string; envID?: EnvironmentID }): Promise<SwarmNode> {
		return this.rest.get(this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}`), {
			decode: SwarmNode.decode
		});
	}

	nodeAgentDeployment(args: {
		nodeId: string;
		rotate?: boolean;
		envID?: EnvironmentID;
	}): Promise<SwarmNodeAgentDeployment> {
		const body: SwarmNodeAgentDeploymentRequest = { rotate: args.rotate ?? false };
		return this.rest.post(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}/agent/deployment`),
			{ body, decode: SwarmNodeAgentDeployment.decode }
		);
	}

	reconcileNodeAgents(
		args: { envID?: EnvironmentID; options?: ArcaneRequestOptions } = {}
	): Promise<SwarmNodeAgentReconcileResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'swarm/nodes/agents/reconcile'), {
			body: {},
			options: args.options,
			decode: SwarmNodeAgentReconcileResponse.decode
		});
	}

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

	deleteNode(args: { nodeId: string; force?: boolean; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}`),
			{
				query: [{ name: 'force', value: boolString(args.force ?? false) }]
			}
		);
	}

	promoteNode(args: { nodeId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}/promote`)
		);
	}

	demoteNode(args: { nodeId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(
			this.rest.environmentPath(args.envID, `swarm/nodes/${args.nodeId}/demote`)
		);
	}

	nodeTasks(
		args: { nodeId: string } & SwarmListArgs
	): Promise<PaginatedResponse<SwarmTaskSummary>> {
		return this.paginatedList(`swarm/nodes/${args.nodeId}/tasks`, args);
	}

	listTasks(args: SwarmListArgs = {}): Promise<PaginatedResponse<SwarmTaskSummary>> {
		return this.paginatedList('swarm/tasks', args);
	}

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
