import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import {
	UpdaterResult,
	type AutoUpdateRecord,
	type UpdaterOptions,
	type UpdaterStatus
} from '../models/updater/Updater';

export class UpdaterService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	run(args: { options?: UpdaterOptions; envID?: EnvironmentID } = {}): Promise<UpdaterResult> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'updater/run'), {
			body: args.options,
			decode: UpdaterResult.decode
		});
	}

	status(args: { envID?: EnvironmentID } = {}): Promise<UpdaterStatus> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'updater/status'));
	}

	history(args: { limit?: number; envID?: EnvironmentID } = {}): Promise<AutoUpdateRecord[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'updater/history'), {
			query: [{ name: 'limit', value: String(args.limit ?? 50) }]
		});
	}

	updateContainer(args: { containerId: string; envID?: EnvironmentID }): Promise<UpdaterResult> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `containers/${args.containerId}/update`),
			{
				decode: UpdaterResult.decode
			}
		);
	}
}
