import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import { DockerInfo } from '../models/system/DockerInfo';
import type { ConvertDockerRunRequest, ConvertDockerRunResponse } from '../models/system/DockerRun';
import type { HealthResponse } from '../models/system/HealthResponse';
import { PruneAllResult, type PruneAllRequest } from '../models/system/Prune';
import type { SystemStats } from '../models/system/SystemStats';
import {
	EnvironmentUpdateJob,
	SystemContainerActionResult,
	type UpgradeCheckResult
} from '../models/system/Upgrade';
import { StatsStream } from '../streaming/Streams';

export class SystemService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	async apiHealth(): Promise<HealthResponse> {
		const text = await this.rest.transport.rawRequest('health', {
			method: 'GET',
			authorized: false
		});
		return this.rest.transport.decode<HealthResponse>(text);
	}

	async health(args: { envID?: EnvironmentID } = {}): Promise<void> {
		await this.rest.transport.rawRequest(this.rest.environmentPath(args.envID, 'system/health'), {
			method: 'HEAD',
			authorized: true
		});
	}

	async dockerInfo(args: { envID?: EnvironmentID } = {}): Promise<DockerInfo> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'system/docker/info'),
			{ authorized: true }
		);
		return this.rest.transport.decode(text, DockerInfo.decode);
	}

	prune(args: { options: PruneAllRequest; envID?: EnvironmentID }): Promise<PruneAllResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'system/prune'), {
			body: args.options,
			decode: PruneAllResult.decode
		});
	}

	startAllContainers(args: { envID?: EnvironmentID } = {}): Promise<SystemContainerActionResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'system/containers/start-all'), {
			decode: SystemContainerActionResult.decode
		});
	}

	startAllStoppedContainers(
		args: { envID?: EnvironmentID } = {}
	): Promise<SystemContainerActionResult> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, 'system/containers/start-stopped'),
			{
				decode: SystemContainerActionResult.decode
			}
		);
	}

	stopAllContainers(args: { envID?: EnvironmentID } = {}): Promise<SystemContainerActionResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'system/containers/stop-all'), {
			decode: SystemContainerActionResult.decode
		});
	}

	async convertDockerRun(args: {
		request: ConvertDockerRunRequest;
		envID?: EnvironmentID;
	}): Promise<ConvertDockerRunResponse> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'system/convert'),
			{ method: 'POST', body: args.request, authorized: true }
		);
		return this.rest.transport.decode<ConvertDockerRunResponse>(text);
	}

	async checkUpgrade(args: { envID?: EnvironmentID } = {}): Promise<UpgradeCheckResult> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'system/upgrade/check'),
			{ method: 'GET', authorized: true }
		);
		return this.rest.transport.decode<UpgradeCheckResult>(text);
	}

	triggerUpgrade(args: { envID?: EnvironmentID } = {}): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'system/upgrade'));
	}

	triggerUpdateAll(args: { envID?: EnvironmentID } = {}): Promise<EnvironmentUpdateJob> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'system/upgrade/all'), {
			decode: EnvironmentUpdateJob.decode
		});
	}

	updateAllStatus(args: { envID?: EnvironmentID } = {}): Promise<EnvironmentUpdateJob> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'system/upgrade/all/status'), {
			decode: EnvironmentUpdateJob.decode
		});
	}

	statsStream(args: { envID?: EnvironmentID } = {}): StatsStream<SystemStats> {
		return new StatsStream<SystemStats>(
			this.rest.transport,
			this.rest.environmentPath(args.envID, 'ws/system/stats')
		);
	}

	downloadEdgeMTLSCA(): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw('edge-mtls/ca', { authorized: false });
	}
}
