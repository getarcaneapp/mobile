import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import type {
	JobListResponse,
	JobRunResponse,
	JobScheduleConfig,
	UpdateJobScheduleConfig
} from '../models/jobSchedule/JobSchedule';

export class JobsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	async getSchedules(args: { envID?: EnvironmentID } = {}): Promise<JobScheduleConfig> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'job-schedules')
		);
		return this.rest.transport.decode<JobScheduleConfig>(text);
	}

	updateSchedules(args: {
		body: UpdateJobScheduleConfig;
		envID?: EnvironmentID;
	}): Promise<JobScheduleConfig> {
		return this.rest.put(this.rest.environmentPath(args.envID, 'job-schedules'), {
			body: args.body
		});
	}

	async list(args: { envID?: EnvironmentID } = {}): Promise<JobListResponse> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'jobs')
		);
		return this.rest.transport.decode<JobListResponse>(text);
	}

	async run(args: { jobID: string; envID?: EnvironmentID }): Promise<JobRunResponse> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, `jobs/${args.jobID}/run`),
			{ method: 'POST' }
		);
		return this.rest.transport.decode<JobRunResponse>(text);
	}
}
