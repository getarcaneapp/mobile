/** Port of Services/UpdaterService.swift. */
import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import {
	UpdaterResult,
	type AutoUpdateRecord,
	type UpdaterOptions,
	type UpdaterStatus
} from '../models/updater/Updater';

/**
 * Facade for the updater endpoints under `/environments/{id}/updater` and
 * `/environments/{id}/containers/{containerId}/update`.
 */
export class UpdaterService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** Runs the updater. When `options` is omitted the server uses its defaults. */
	run(args: { options?: UpdaterOptions; envID?: EnvironmentID } = {}): Promise<UpdaterResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'updater/run'), {
			body: args.options,
			decode: UpdaterResult.decode
		});
	}

	/** Returns the live updater status. */
	status(args: { envID?: EnvironmentID } = {}): Promise<UpdaterStatus> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'updater/status'));
	}

	/** Returns the most recent `limit` history records. */
	history(args: { limit?: number; envID?: EnvironmentID } = {}): Promise<AutoUpdateRecord[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'updater/history'), {
			query: [{ name: 'limit', value: String(args.limit ?? 50) }]
		});
	}

	/**
	 * Updates a single container by pulling the latest image and applying the
	 * appropriate strategy server-side.
	 */
	updateContainer(args: { containerId: string; envID?: EnvironmentID }): Promise<UpdaterResult> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `containers/${args.containerId}/update`),
			{
				decode: UpdaterResult.decode
			}
		);
	}
}
