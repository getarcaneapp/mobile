import type { OperationStreamEvent } from '@/sdk/types/streaming/OperationStreamEvent';

export type OperationProgress = { phase: string; progress?: number };
export type OperationOutcome = 'success' | 'failure' | 'cancelled';

type PullLayer = { total: number; downloaded: number; extracted: number };

const downloadWeight = 0.75;
const maxPullLayers = 2_000;
const downloadedStatuses = new Set(['Verifying Checksum', 'Download complete']);
const completedStatuses = new Set(['Pull complete', 'Already exists']);
const pendingStatuses = new Set(['Pulling fs layer', 'Waiting']);

function fraction(current: number | undefined, total: number): number {
	if (current === undefined || !Number.isFinite(current) || total <= 0) return 0;
	return Math.min(Math.max(current / total, 0), 1);
}

export function createPullProgress() {
	const layers = new Map<string, PullLayer>();
	const pending = new Set<string>();
	let started = false;
	let finishing = false;
	let best = 0;

	const layerFor = (id: string, total: number | undefined): PullLayer | undefined => {
		const known = layers.get(id);
		if (known) {
			if (known.total <= 0 && total !== undefined && total > 0) known.total = total;
			return known;
		}
		if (total === undefined || total <= 0 || layers.size >= maxPullLayers) return undefined;
		const layer = { total, downloaded: 0, extracted: 0 };
		layers.set(id, layer);
		return layer;
	};

	const overall = (): number | undefined => {
		let total = 0;
		let done = 0;
		for (const layer of layers.values()) {
			total += layer.total;
			done +=
				layer.total * (layer.downloaded * downloadWeight + layer.extracted * (1 - downloadWeight));
		}
		if (total <= 0) return undefined;
		best = Math.max(best, Math.min(done / total, 1));
		return best;
	};

	const phase = (): string => {
		if (finishing) return 'Finishing';
		if (!started) return 'Pulling';
		if (pending.size > 0) return 'Downloading';
		for (const layer of layers.values()) if (layer.downloaded < 1) return 'Downloading';
		for (const layer of layers.values()) if (layer.extracted < 1) return 'Extracting';
		return 'Pulling';
	};

	return {
		apply(event: OperationStreamEvent): OperationProgress {
			const status = event.status?.trim() ?? '';
			const id = event.id?.trim() ?? '';
			const detail = event.progressDetail;
			if (status.startsWith('Digest:') || status.startsWith('Status:')) finishing = true;
			if (id !== '' && status !== '' && !status.startsWith('Pulling from')) {
				if (pendingStatuses.has(status)) {
					started = true;
					if (!layers.has(id)) pending.add(id);
				} else if (status === 'Downloading') {
					started = true;
					pending.delete(id);
					const layer = layerFor(id, detail?.total);
					if (layer) layer.downloaded = fraction(detail?.current, layer.total);
				} else if (status === 'Extracting') {
					started = true;
					pending.delete(id);
					const layer = layerFor(id, detail?.total);
					if (layer) {
						layer.downloaded = 1;
						layer.extracted = Math.max(layer.extracted, fraction(detail?.current, layer.total));
					}
				} else if (downloadedStatuses.has(status)) {
					pending.delete(id);
					const layer = layers.get(id);
					if (layer) layer.downloaded = 1;
				} else if (completedStatuses.has(status)) {
					pending.delete(id);
					const layer = layers.get(id);
					if (layer) {
						layer.downloaded = 1;
						layer.extracted = 1;
					}
				}
			}
			return { phase: phase(), progress: overall() };
		}
	};
}

export type PullProgress = ReturnType<typeof createPullProgress>;

const classicStep = /^Step (\d+)\/(\d+)\s*:/;
const buildKitStep = /^#\d+ \[(?:[^\]]*\s)?(\d+)\/(\d+)\]/;

export function buildStepProgress(event: OperationStreamEvent): OperationProgress | undefined {
	const text = (event.stream ?? event.log)?.trim();
	if (!text) return undefined;
	const match = classicStep.exec(text) ?? buildKitStep.exec(text);
	if (!match) return undefined;
	const step = Number(match[1]);
	const total = Number(match[2]);
	if (!Number.isInteger(step) || !Number.isInteger(total) || total <= 0 || step < 1)
		return undefined;
	const service = event.service?.trim();
	const label = `Step ${Math.min(step, total)}/${total}`;
	return {
		phase: service ? `${service}: ${label}` : label,
		progress: fraction(step - 1, total)
	};
}

export type TrackedProgress = OperationProgress & { outcome?: OperationOutcome };

export function activityProgress(
	activity: { status: string; step: string; progress?: number },
	runningPhase: string
): TrackedProgress | undefined {
	const progress =
		activity.progress === undefined || !Number.isFinite(activity.progress)
			? undefined
			: Math.min(Math.max(activity.progress / 100, 0), 1);
	switch (activity.status) {
		case 'success':
			return { outcome: 'success', phase: 'Complete', progress: 1 };
		case 'failed':
			return { outcome: 'failure', phase: 'Failed', progress };
		case 'cancelled':
			return { outcome: 'cancelled', phase: 'Cancelled', progress };
		case 'queued':
			return { phase: 'Queued', progress };
		case 'running':
			return { phase: activity.step.trim() || runningPhase, progress };
		default:
			return undefined;
	}
}

export function backupRunOutcome(status: string): OperationOutcome | undefined {
	switch (status.trim().toLowerCase()) {
		case 'succeeded':
		case 'success':
			return 'success';
		case 'failed':
			return 'failure';
		case 'cancelled':
		case 'canceled':
			return 'cancelled';
		default:
			return undefined;
	}
}
