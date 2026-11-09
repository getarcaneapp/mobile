import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { EnvironmentUpdateJob } from '@/sdk/models/system/Upgrade';

export const managerEnvironmentID = '0';

const pollIntervalMs = 3000;
const streamRetryDelayMs = 2000;
const reconnectingAfterFailures = 2;
const maxPollFailures = 60;

export type UpgradeJobFollowHandlers = {
	onJob: (job: EnvironmentUpdateJob) => void;
	onFinish: (job: EnvironmentUpdateJob) => void;
	onReconnecting: (job: EnvironmentUpdateJob) => void;
	onLost: (job: EnvironmentUpdateJob) => void;
};

const wait = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true }
		);
	});

function updatedAt(job: EnvironmentUpdateJob): number {
	return Date.parse(job.updatedAt ?? '') || 0;
}

export function isNewerUpgradeJob(
	next: EnvironmentUpdateJob,
	current: EnvironmentUpdateJob
): boolean {
	if (next.id !== current.id) return false;
	if (EnvironmentUpdateJob.isTerminal(current) && !EnvironmentUpdateJob.isTerminal(next))
		return false;
	return updatedAt(next) >= updatedAt(current);
}

async function streamJobs(
	client: ArcaneClient,
	signal: AbortSignal,
	onJob: (job: EnvironmentUpdateJob) => void
): Promise<void> {
	while (!signal.aborted) {
		try {
			for await (const event of client.withSignal(signal).system.upgradeJobStream()) {
				if (event.job) onJob(event.job);
			}
		} catch {
			if (signal.aborted) return;
		}
		await wait(streamRetryDelayMs, signal);
	}
}

async function pollJobs(
	client: ArcaneClient,
	signal: AbortSignal,
	onJob: (job: EnvironmentUpdateJob) => void,
	onFailure: (count: number) => void
): Promise<void> {
	let failures = 0;
	while (!signal.aborted) {
		await wait(pollIntervalMs, signal);
		if (signal.aborted) return;
		try {
			const job = await client.system.updateAllStatus({ envID: managerEnvironmentID });
			if (signal.aborted) return;
			failures = 0;
			onJob(job);
		} catch {
			if (signal.aborted) return;
			failures += 1;
			onFailure(failures);
		}
	}
}

export function followUpgradeJob(args: {
	client: ArcaneClient;
	job: EnvironmentUpdateJob;
	streams: boolean;
	handlers: UpgradeJobFollowHandlers;
}): () => void {
	const controller = new AbortController();
	const { signal } = controller;
	let current = args.job;

	const receive = (job: EnvironmentUpdateJob) => {
		if (signal.aborted || !isNewerUpgradeJob(job, current)) return;
		current = job;
		if (EnvironmentUpdateJob.isTerminal(job)) {
			controller.abort();
			args.handlers.onFinish(job);
			return;
		}
		args.handlers.onJob(job);
	};

	const failed = (count: number) => {
		if (count === reconnectingAfterFailures) args.handlers.onReconnecting(current);
		if (count < maxPollFailures) return;
		controller.abort();
		args.handlers.onLost(current);
	};

	if (EnvironmentUpdateJob.isTerminal(current)) {
		args.handlers.onFinish(current);
		return () => controller.abort();
	}
	if (args.streams) void streamJobs(args.client, signal, receive);
	void pollJobs(args.client, signal, receive, failed);
	return () => controller.abort();
}

export function managerRestarting(job: EnvironmentUpdateJob): boolean {
	const status = EnvironmentUpdateJob.managerResult(job)?.status;
	return (
		job.status === 'pending_restart' &&
		(status === 'updated' || status === 'triggered' || status === 'updating')
	);
}

export function failedEnvironmentIDs(job: EnvironmentUpdateJob): string[] {
	return (job.results ?? [])
		.filter((result) => result.status === 'failed')
		.map((result) => result.environmentId);
}

export function resultLogs(lines: readonly string[] | undefined, limit = 200): string {
	const all = lines ?? [];
	return all.slice(Math.max(0, all.length - limit)).join('\n');
}
