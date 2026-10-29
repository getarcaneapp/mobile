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

export interface CreateEnvironmentResult {
	environment: Environment;
	apiKey?: string;
}

export const CreateEnvironmentResult = {
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

	encode(this: void, value: CreateEnvironmentResult): Environment {
		return { ...value.environment, apiKey: value.apiKey ?? value.environment.apiKey };
	}
} as const;

export class EnvironmentsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

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

	get(args: { id: EnvironmentID }): Promise<Environment> {
		return this.rest.get(`environments/${args.id}`);
	}

	create(args: { request: CreateEnvironment }): Promise<CreateEnvironmentResult> {
		return this.rest.post('environments', {
			body: args.request,
			decode: CreateEnvironmentResult.decode
		});
	}

	createAgent(args: { name: string; enabled?: boolean }): Promise<CreateEnvironmentResult> {
		return this.rest.post('environments', {
			body: { name: args.name, enabled: args.enabled ?? true },
			decode: CreateEnvironmentResult.decode
		});
	}

	update(args: { id: EnvironmentID; request: UpdateEnvironment }): Promise<Environment> {
		return this.rest.put(`environments/${args.id}`, { body: args.request });
	}

	delete(args: { id: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(`environments/${args.id}`);
	}

	testConnection(args: {
		id: EnvironmentID;
		request?: TestConnectionRequest;
	}): Promise<EnvironmentTestResult> {
		return this.rest.post(`environments/${args.id}/test`, { body: args.request });
	}

	updateHeartbeat(args: { id: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(`environments/${args.id}/heartbeat`);
	}

	sync(args: { id: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(`environments/${args.id}/sync`);
	}

	version(args: { id: EnvironmentID }): Promise<EnvironmentVersion> {
		return this.rest.get(`environments/${args.id}/version`);
	}

	pairAgent(
		args: { id?: EnvironmentID; request?: AgentPairRequest } = {}
	): Promise<AgentPairResponse> {
		return this.rest.post(`environments/${args.id ?? EnvironmentID.localDocker}/agent/pair`, {
			body: args.request
		});
	}

	pairEnvironment(): Promise<void> {
		return this.rest.postVoid('environments/pair');
	}

	deploymentSnippets(args: { id: EnvironmentID }): Promise<DeploymentSnippet> {
		return this.rest.get(`environments/${args.id}/deployment`);
	}

	downloadMTLSBundle(args: { id: EnvironmentID }): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(`environments/${args.id}/deployment/mtls/bundle`);
	}

	downloadMTLSFile(args: { id: EnvironmentID; fileName: string }): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(
			`environments/${args.id}/deployment/mtls/${args.fileName}`
		);
	}
}
