/** Port of Services/EnvironmentsService.swift. */
import { EnvironmentID } from '../client/environment';
import type { QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import { D } from '../models/base/decoding';
import { SearchPaginationSort } from '../models/base/pagination';
import type { DeploymentSnippet } from '../models/environment/Deployment';
import type {
	AgentPairRequest,
	AgentPairResponse,
	CreateEnvironment,
	EdgeMTLSCertificate,
	Environment,
	EnvironmentTestResult,
	EnvironmentVersion,
	TestConnectionRequest,
	UpdateEnvironment
} from '../models/environment/EnvironmentModel';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

/**
 * Response payload returned by `EnvironmentsService.create`: the created
 * environment plus an optional one-time API key.
 */
export interface CreateEnvironmentResult {
	environment: Environment;
	apiKey?: string;
}

export const CreateEnvironmentResult = {
	/**
	 * Swift `init(from:)`: the server returns a flat environment object (with
	 * `apiKey` alongside); `lastEdgeTransport` is not part of the wire format.
	 */
	decode(this: void, raw: unknown): CreateEnvironmentResult {
		const o = D.object(raw, 'CreateEnvironmentResult');
		const apiKey = D.optString(o, 'apiKey');
		return {
			environment: {
				id: D.string(o, 'id'),
				name: D.optString(o, 'name'),
				apiUrl: D.string(o, 'apiUrl'),
				status: D.string(o, 'status'),
				enabled: D.boolean(o, 'enabled'),
				isEdge: D.boolean(o, 'isEdge'),
				lastSeen: D.optString(o, 'lastSeen'),
				edgeTransport: D.optString(o, 'edgeTransport'),
				edgeSecurityMode: D.optString(o, 'edgeSecurityMode'),
				edgeSessionId: D.optString(o, 'edgeSessionId'),
				edgeAgentInstance: D.optString(o, 'edgeAgentInstance'),
				edgeCapabilities: D.optArray(o, 'edgeCapabilities', D.str),
				connected: D.optBoolean(o, 'connected'),
				connectedAt: D.optString(o, 'connectedAt'),
				lastHeartbeat: D.optString(o, 'lastHeartbeat'),
				lastPollAt: D.optString(o, 'lastPollAt'),
				edgeMTLSCertificate: D.optNested(o, 'edgeMTLSCertificate', D.cast<EdgeMTLSCertificate>),
				apiKey
			},
			apiKey
		};
	},

	/** Swift `encode(to:)`: the flat environment with `apiKey` taken from the result. */
	encode(this: void, value: CreateEnvironmentResult): Environment {
		return { ...value.environment, apiKey: value.apiKey ?? value.environment.apiKey };
	}
} as const;

/**
 * Exposes the environment management endpoints registered under
 * `/environments` along with agent pairing, mTLS, and version helpers.
 */
export class EnvironmentsService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - CRUD

	/** Paginated list of environments. */
	list(
		args: { query?: SearchPaginationSort; type?: string } = {}
	): Promise<PaginatedResponse<Environment>> {
		const query = args.query ?? {};
		const items: QueryItem[] = SearchPaginationSort.nonPaginationQueryItems(query);
		if (args.type !== undefined) items.push({ name: 'type', value: args.type });
		return this.rest.paginated<Environment>('environments', {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: items
		});
	}

	/** Get an environment by ID. */
	get(args: { id: EnvironmentID }): Promise<Environment> {
		return this.rest.get(`environments/${args.id}`);
	}

	/**
	 * Create a new environment. The response may include a one-time API key
	 * when `CreateEnvironment.useApiKey` is set to `true`.
	 */
	create(args: { request: CreateEnvironment }): Promise<CreateEnvironmentResult> {
		return this.rest.post('environments', {
			body: args.request,
			decode: CreateEnvironmentResult.decode
		});
	}

	/** Update an environment. */
	update(args: { id: EnvironmentID; request: UpdateEnvironment }): Promise<Environment> {
		return this.rest.put(`environments/${args.id}`, { body: args.request });
	}

	/** Delete an environment. The local environment cannot be deleted. */
	delete(args: { id: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(`environments/${args.id}`);
	}

	// MARK: - Status / Connectivity

	/** Test connectivity to an environment, optionally overriding the URL. */
	testConnection(args: {
		id: EnvironmentID;
		request?: TestConnectionRequest;
	}): Promise<EnvironmentTestResult> {
		return this.rest.post(`environments/${args.id}/test`, { body: args.request });
	}

	/** Update the heartbeat timestamp for an environment. */
	updateHeartbeat(args: { id: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(`environments/${args.id}/heartbeat`);
	}

	/** Sync container registries and git repositories to an environment. */
	sync(args: { id: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(`environments/${args.id}/sync`);
	}

	/** Get the version of a remote environment. */
	version(args: { id: EnvironmentID }): Promise<EnvironmentVersion> {
		return this.rest.get(`environments/${args.id}/version`);
	}

	// MARK: - Agent pairing

	/** Pair the manager with the local agent, optionally rotating the token. */
	pairAgent(
		args: { id?: EnvironmentID; request?: AgentPairRequest } = {}
	): Promise<AgentPairResponse> {
		return this.rest.post(`environments/${args.id ?? EnvironmentID.localDocker}/agent/pair`, {
			body: args.request
		});
	}

	/**
	 * Complete the agent-to-manager pairing handshake by submitting the API
	 * key issued during environment creation. The agent sends this request
	 * with no Authorization header; the API key header is set by the caller.
	 */
	pairEnvironment(): Promise<void> {
		return this.rest.postVoid('environments/pair');
	}

	// MARK: - Deployment snippets / mTLS

	/** Get the deployment snippets (docker run / compose / optional mTLS) for an environment. */
	deploymentSnippets(args: { id: EnvironmentID }): Promise<DeploymentSnippet> {
		return this.rest.get(`environments/${args.id}/deployment`);
	}

	/** Download the mTLS certificate bundle (zip) for an environment. */
	downloadMTLSBundle(args: { id: EnvironmentID }): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(`environments/${args.id}/deployment/mtls/bundle`);
	}

	/** Download a single mTLS file (PEM/key/etc.) for an environment. */
	downloadMTLSFile(args: { id: EnvironmentID; fileName: string }): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(
			`environments/${args.id}/deployment/mtls/${args.fileName}`
		);
	}
}
