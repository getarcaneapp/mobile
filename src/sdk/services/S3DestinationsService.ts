/** Port of Services/S3DestinationsService.swift. */
import type { RESTService } from '../http/RESTService';
import { MessageResponse } from '../models/base/message';
import { SearchPaginationSort } from '../models/base/pagination';
import type { UpdateS3Destination } from '../models/backup/BackupAliases';
import type { CreateS3Destination } from '../models/backup/CreateS3Destination';
import type { S3Destination } from '../models/backup/S3Destination';
import type { S3DestinationUsage } from '../models/backup/S3DestinationUsage';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export class S3DestinationsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	list(args: { query?: SearchPaginationSort } = {}): Promise<PaginatedResponse<S3Destination>> {
		const query = args.query ?? {};
		return this.rest.paginated('backups/s3', {
			start: query.start ?? 0,
			limit: query.limit ?? 20,
			query: SearchPaginationSort.nonPaginationQueryItems(query)
		});
	}

	options(): Promise<S3Destination[]> {
		return this.rest.requestPayload('backups/s3/options', { method: 'GET' });
	}

	get(args: { id: string }): Promise<S3Destination> {
		return this.rest.requestPayload(`backups/s3/${args.id}`, { method: 'GET' });
	}

	create(args: { request: CreateS3Destination }): Promise<S3Destination> {
		return this.rest.requestPayload('backups/s3', { body: args.request });
	}

	/** An empty secretAccessKey preserves the stored secret. */
	update(args: { id: string; request: UpdateS3Destination }): Promise<S3Destination> {
		return this.rest.requestPayload(`backups/s3/${args.id}`, { method: 'PUT', body: args.request });
	}

	delete(args: { id: string }): Promise<MessageResponse> {
		return this.rest.delete(`backups/s3/${args.id}`, { decode: MessageResponse.decode });
	}

	/** Tests an unsaved configuration. Swift overload `test(configuration:)`. */
	testConfiguration(args: { configuration: CreateS3Destination }): Promise<MessageResponse> {
		return this.rest.requestPayload('backups/s3/test', {
			body: args.configuration,
			decode: MessageResponse.decode
		});
	}

	/** Tests a saved destination, optionally with overrides. Swift `test(id:configuration:)`. */
	test(args: { id: string; configuration?: UpdateS3Destination }): Promise<MessageResponse> {
		return this.rest.requestPayload(`backups/s3/${args.id}/test`, {
			body: args.configuration,
			decode: MessageResponse.decode
		});
	}

	usage(args: { id: string }): Promise<S3DestinationUsage> {
		return this.rest.requestPayload(`backups/s3/${args.id}/in-use`, { method: 'GET' });
	}
}
