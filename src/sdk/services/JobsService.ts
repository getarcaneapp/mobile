/** Port of Services/JobsService.swift: background job schedules and manual execution for an environment. */
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

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/**
	 * Get configured cron schedules for background jobs.
	 * The endpoint returns the config object directly (no `APIResponse` envelope).
	 */
	async getSchedules(args: { envID?: EnvironmentID } = {}): Promise<JobScheduleConfig> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'job-schedules')
		);
		return this.rest.transport.decode<JobScheduleConfig>(text);
	}

	/** Update background job cron schedules. Only defined fields are applied. */
	updateSchedules(args: {
		body: UpdateJobScheduleConfig;
		envID?: EnvironmentID;
	}): Promise<JobScheduleConfig> {
		return this.rest.put(this.rest.environmentPath(args.envID, 'job-schedules'), {
			body: args.body
		});
	}

	/**
	 * List all background jobs with their status, schedule, and metadata.
	 * The endpoint returns the list object directly (no `APIResponse` envelope).
	 */
	async list(args: { envID?: EnvironmentID } = {}): Promise<JobListResponse> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, 'jobs')
		);
		return this.rest.transport.decode<JobListResponse>(text);
	}

	/**
	 * Manually trigger a background job to run immediately.
	 * The endpoint returns the run-response body directly (no `APIResponse` envelope).
	 */
	async run(args: { jobID: string; envID?: EnvironmentID }): Promise<JobRunResponse> {
		const text = await this.rest.transport.rawRequest(
			this.rest.environmentPath(args.envID, `jobs/${args.jobID}/run`),
			{ method: 'POST' }
		);
		return this.rest.transport.decode<JobRunResponse>(text);
	}
}
