/** Port of Services/ContainersService.swift. */
import type { ArcaneAuthorizedRequest } from '../client/ArcaneTransport';
import type { EnvironmentID } from '../client/environment';
import { boolString, q, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { ContainerCreate } from '../models/container/ContainerCreate';
import { ContainerDetails, ContainerListResponse } from '../models/container/ContainerDetails';
import type {
	ContainerCommitRequest,
	ContainerCommitResult,
	ContainerEdit,
	ContainerEditConfig,
	ContainerGenerateComposeRequest,
	ContainerGenerateComposeResponse
} from '../models/container/ContainerEditing';
import { ContainerStatsPayload } from '../models/container/ContainerStats';
import type { ContainerCreated, ContainerStatusCounts } from '../models/container/ContainerSummary';
import { MessageResponse } from '../models/base/message';
import { SearchPaginationSort } from '../models/base/pagination';
import { LogStream, StatsStream } from '../streaming/Streams';
import { TerminalSession } from '../streaming/TerminalSession';

export class ContainersService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - Listing

	/** Paginated list of containers in an environment. */
	async list(
		args: {
			envID?: EnvironmentID;
			query?: SearchPaginationSort;
			groupBy?: string;
			includeInternal?: boolean;
			includeHidden?: boolean;
			updates?: string;
			standalone?: string;
			label?: string;
		} = {}
	): Promise<ContainerListResponse> {
		const items = SearchPaginationSort.queryItems(args.query ?? {});
		if (args.groupBy !== undefined) items.push(q('groupBy', args.groupBy));
		if (args.includeInternal !== undefined)
			items.push(q('includeInternal', boolString(args.includeInternal)));
		if (args.includeHidden !== undefined)
			items.push(q('includeHidden', boolString(args.includeHidden)));
		if (args.updates !== undefined) items.push(q('updates', args.updates));
		if (args.standalone !== undefined) items.push(q('standalone', args.standalone));
		if (args.label !== undefined) items.push(q('label', args.label));
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'containers'),
			{
				query: items
			}
		);
		return this.rest.transport.decode(text, ContainerListResponse.decode);
	}

	/** Container counts by status for an environment. */
	statusCounts(
		args: { envID?: EnvironmentID; includeInternal?: boolean; includeHidden?: boolean } = {}
	): Promise<ContainerStatusCounts> {
		const items: QueryItem[] = [];
		if (args.includeInternal !== undefined)
			items.push(q('includeInternal', boolString(args.includeInternal)));
		if (args.includeHidden !== undefined)
			items.push(q('includeHidden', boolString(args.includeHidden)));
		return this.rest.get(this.rest.environmentPath(args.envID, 'containers/counts'), {
			query: items
		});
	}

	// MARK: - CRUD

	/** Inspect a single container. */
	inspect(args: { envID?: EnvironmentID; id: string }): Promise<ContainerDetails> {
		return this.rest.get(this.rest.environmentPath(args.envID, `containers/${args.id}`), {
			decode: ContainerDetails.decode
		});
	}

	/** Create a new container. */
	create(args: { envID?: EnvironmentID; body: ContainerCreate }): Promise<ContainerCreated> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'containers'), { body: args.body });
	}

	/** Load the editable configuration, including Compose ownership and edit restrictions. */
	editConfig(args: { envID?: EnvironmentID; id: string }): Promise<ContainerEditConfig> {
		return this.rest.get(
			this.rest.environmentPath(args.envID, `containers/${args.id}/edit-config`)
		);
	}

	/** Apply the supplied fields and recreate the container. The result contains its new ID. */
	edit(args: {
		envID?: EnvironmentID;
		id: string;
		body: ContainerEdit;
	}): Promise<ContainerDetails> {
		return this.rest.post(this.rest.environmentPath(args.envID, `containers/${args.id}/edit`), {
			body: args.body,
			decode: ContainerDetails.decode
		});
	}

	/** Create an image from the container's filesystem. */
	commit(args: {
		envID?: EnvironmentID;
		id: string;
		body: ContainerCommitRequest;
	}): Promise<ContainerCommitResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, `containers/${args.id}/commit`), {
			body: args.body
		});
	}

	/** Generate a Compose document from selected containers. */
	generateCompose(args: {
		envID?: EnvironmentID;
		body: ContainerGenerateComposeRequest;
	}): Promise<ContainerGenerateComposeResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'containers/generate-compose'), {
			body: args.body
		});
	}

	/** Delete a container, optionally forcing removal of running containers and removing associated volumes. */
	delete(args: {
		envID?: EnvironmentID;
		id: string;
		force?: boolean;
		removeVolumes?: boolean;
	}): Promise<MessageResponse> {
		const query: QueryItem[] = [
			q('force', boolString(args.force ?? false)),
			q('volumes', boolString(args.removeVolumes ?? false))
		];
		return this.rest.delete(this.rest.environmentPath(args.envID, `containers/${args.id}`), {
			query,
			decode: MessageResponse.decode
		});
	}

	// MARK: - Lifecycle

	start(args: { envID?: EnvironmentID; id: string }): Promise<MessageResponse> {
		return this.lifecycle(args, 'start');
	}

	stop(args: { envID?: EnvironmentID; id: string }): Promise<MessageResponse> {
		return this.lifecycle(args, 'stop');
	}

	restart(args: { envID?: EnvironmentID; id: string }): Promise<MessageResponse> {
		return this.lifecycle(args, 'restart');
	}

	/**
	 * Redeploy a container: pulls the latest image and recreates the container.
	 * Returns the new container's details.
	 */
	redeploy(args: { envID?: EnvironmentID; id: string }): Promise<ContainerDetails> {
		return this.rest.post(this.rest.environmentPath(args.envID, `containers/${args.id}/redeploy`), {
			decode: ContainerDetails.decode
		});
	}

	/** Pause a running container. */
	pause(args: { envID?: EnvironmentID; id: string }): Promise<MessageResponse> {
		return this.lifecycle(args, 'pause');
	}

	/** Resume a paused container. */
	unpause(args: { envID?: EnvironmentID; id: string }): Promise<MessageResponse> {
		return this.lifecycle(args, 'unpause');
	}

	/** Send a signal to a running container (default: SIGKILL). */
	kill(args: { envID?: EnvironmentID; id: string; signal?: string }): Promise<MessageResponse> {
		return this.rest.post(this.rest.environmentPath(args.envID, `containers/${args.id}/kill`), {
			query: [q('signal', args.signal ?? 'SIGKILL')],
			decode: MessageResponse.decode
		});
	}

	/** Rename an existing container. */
	rename(args: { envID?: EnvironmentID; id: string; newName: string }): Promise<void> {
		return this.rest.postVoid(
			this.rest.environmentPath(args.envID, `containers/${args.id}/rename`),
			{
				query: [q('name', args.newName)]
			}
		);
	}

	/** Enable or disable auto-update for a specific container. */
	setAutoUpdate(args: { envID?: EnvironmentID; id: string; enabled: boolean }): Promise<void> {
		return this.rest.putVoid(
			this.rest.environmentPath(args.envID, `containers/${args.id}/auto-update`),
			{
				body: { enabled: args.enabled }
			}
		);
	}

	// MARK: - WebSocket streams

	/** Download every log line Docker retains for the container as raw bytes. */
	downloadLogs(args: { envID?: EnvironmentID; id: string }): Promise<Uint8Array> {
		return this.rest.transport.downloadRaw(
			this.rest.environmentPath(args.envID, `containers/${args.id}/logs/download`)
		);
	}

	/**
	 * Replacement for Swift `downloadLogs(envID:id:to:)`: authenticated URL +
	 * headers for streaming the logs to disk with expo-file-system.
	 */
	downloadLogsDownloadRequest(args: {
		envID?: EnvironmentID;
		id: string;
	}): Promise<ArcaneAuthorizedRequest> {
		return this.rest.transport.downloadRequest(
			this.rest.environmentPath(args.envID, `containers/${args.id}/logs/download`)
		);
	}

	/**
	 * Stream container log lines. Returns an `AsyncIterable` that finishes when the
	 * remote closes the WebSocket.
	 */
	logs(args: {
		envID?: EnvironmentID;
		id: string;
		follow?: boolean;
		tail?: string;
		since?: string;
		timestamps?: boolean;
	}): LogStream {
		const env = args.envID ?? this.rest.defaultEnvironmentID;
		const query: QueryItem[] = [
			q('follow', boolString(args.follow ?? true)),
			q('tail', args.tail ?? '100'),
			q('timestamps', boolString(args.timestamps ?? false))
		];
		if (args.since !== undefined) query.push(q('since', args.since));
		return new LogStream(
			this.rest.transport,
			`environments/${env}/ws/containers/${args.id}/logs`,
			query
		);
	}

	/** Stream container resource usage stats over WebSocket. */
	stats(args: { envID?: EnvironmentID; id: string }): StatsStream<ContainerStatsPayload> {
		const env = args.envID ?? this.rest.defaultEnvironmentID;
		return new StatsStream<ContainerStatsPayload>(
			this.rest.transport,
			`environments/${env}/ws/containers/${args.id}/stats`,
			[],
			ContainerStatsPayload.decode
		);
	}

	/** Open an interactive terminal session against a running container. */
	exec(args: { envID?: EnvironmentID; id: string; shell?: string }): Promise<TerminalSession> {
		const env = args.envID ?? this.rest.defaultEnvironmentID;
		return TerminalSession.connect(
			this.rest.transport,
			`environments/${env}/ws/containers/${args.id}/terminal`,
			args.shell ?? '/bin/sh'
		);
	}

	private lifecycle(
		args: { envID?: EnvironmentID; id: string },
		action: string
	): Promise<MessageResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `containers/${args.id}/${action}`),
			{
				decode: MessageResponse.decode
			}
		);
	}
}
