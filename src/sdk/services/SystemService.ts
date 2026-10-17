/** Port of Services/SystemService.swift. */
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

/** Facade for system-level endpoints under `/environments/{id}/system`. */
export class SystemService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - Health / Info

	/**
	 * Top-level API health probe (`GET /health`) — does not hit Docker.
	 * Returns the parsed `HealthResponse` (`status == "UP"`) when the server
	 * responds with 2xx. Unauthenticated.
	 */
	async apiHealth(): Promise<HealthResponse> {
		const text = await this.rest.transport.rawRequest('health', {
			method: 'GET',
			authorized: false
		});
		return this.rest.transport.decode<HealthResponse>(text);
	}

	/**
	 * Pings the Docker daemon for a specific environment. Rejects with an
	 * `ArcaneError` if the daemon is unreachable.
	 */
	async health(args: { envID?: EnvironmentID } = {}): Promise<void> {
		await this.rest.transport.rawRequest(this.rest.environmentPath(args.envID, 'system/health'), {
			method: 'HEAD',
			authorized: true
		});
	}

	/**
	 * Returns the Docker daemon version and system info. The response is the
	 * merged `dockerinfo.Info` blob, returned without an `APIResponse` envelope.
	 */
	async dockerInfo(args: { envID?: EnvironmentID } = {}): Promise<DockerInfo> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'system/docker/info'),
			{ authorized: true }
		);
		return this.rest.transport.decode(text, DockerInfo.decode);
	}

	// MARK: - Prune

	/** Removes unused Docker resources according to `options`. */
	prune(args: { options: PruneAllRequest; envID?: EnvironmentID }): Promise<PruneAllResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'system/prune'), {
			body: args.options,
			decode: PruneAllResult.decode
		});
	}

	// MARK: - Bulk container actions

	/** Starts every container (creating them where necessary). */
	startAllContainers(args: { envID?: EnvironmentID } = {}): Promise<SystemContainerActionResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'system/containers/start-all'), {
			decode: SystemContainerActionResult.decode
		});
	}

	/** Starts every stopped container. */
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

	/** Stops every running container. */
	stopAllContainers(args: { envID?: EnvironmentID } = {}): Promise<SystemContainerActionResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'system/containers/stop-all'), {
			decode: SystemContainerActionResult.decode
		});
	}

	// MARK: - Convert / Upgrade

	/**
	 * Converts a `docker run ...` command-line into an equivalent compose
	 * document. The response is returned without the standard envelope.
	 */
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

	/**
	 * Checks whether Arcane can self-upgrade in this environment. The response
	 * is returned without the standard envelope.
	 */
	async checkUpgrade(args: { envID?: EnvironmentID } = {}): Promise<UpgradeCheckResult> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'system/upgrade/check'),
			{ method: 'GET', authorized: true }
		);
		return this.rest.transport.decode<UpgradeCheckResult>(text);
	}

	/**
	 * Triggers a system upgrade. Returns once the upgrade has been scheduled
	 * (HTTP 202 is normal here — the server is mid-replacement).
	 */
	triggerUpgrade(args: { envID?: EnvironmentID } = {}): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'system/upgrade'));
	}

	/**
	 * Triggers a fleet-wide Arcane upgrade: online remote agents are upgraded
	 * first, then the manager itself (which restarts). Manager-only — the
	 * server responds 409 when a job is already running and 400 when running
	 * in agent mode. The environment path segment is ignored server-side;
	 * callers conventionally pass the manager environment (`"0"`).
	 */
	triggerUpdateAll(args: { envID?: EnvironmentID } = {}): Promise<EnvironmentUpdateJob> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'system/upgrade/all'), {
			decode: EnvironmentUpdateJob.decode
		});
	}

	/**
	 * Returns the most recent fleet-wide update-all job. Rejects with
	 * `ArcaneError.notFound` when no job has ever run.
	 */
	updateAllStatus(args: { envID?: EnvironmentID } = {}): Promise<EnvironmentUpdateJob> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'system/upgrade/all/status'), {
			decode: EnvironmentUpdateJob.decode
		});
	}

	// MARK: - WebSocket streams

	/** Streams live system stats over a WebSocket connection. */
	statsStream(args: { envID?: EnvironmentID } = {}): StatsStream<SystemStats> {
		return new StatsStream<SystemStats>(
			this.rest.transport,
			this.rest.environmentPath(args.envID, 'ws/system/stats')
		);
	}

	/** Download the manager's edge mTLS CA certificate (used by agents). */
	downloadEdgeMTLSCA(): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw('edge-mtls/ca', { authorized: false });
	}
}
