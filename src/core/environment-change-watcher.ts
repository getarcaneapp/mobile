import { AppState } from 'react-native';

import { isCancellation } from '@/core/errors';
import { ResponseCache } from '@/core/networking/response-cache';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentChanges } from '@/sdk/models/event/EnvironmentChanges';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useResourceMutationStore, type ResourceKind } from '@/stores/resource-mutation-store';

const allResourceKinds: readonly ResourceKind[] = [
	'containers',
	'images',
	'projects',
	'volumes',
	'networks',
	'environments',
	'swarm'
];

const kindResources: Readonly<Record<string, readonly ResourceKind[]>> = {
	container: ['containers', 'projects', 'images', 'volumes', 'networks'],
	image: ['images'],
	image_update: ['containers', 'projects', 'images'],
	project: ['projects', 'containers'],
	gitops: ['projects'],
	volume: ['volumes'],
	network: ['networks', 'containers'],
	system: ['containers', 'projects', 'images', 'volumes', 'networks'],
	podman: ['containers'],
	environment: ['environments'],
	lifecycle: ['environments'],
	swarm: ['swarm'],
	build: ['images'],
	vulnerability: ['images']
};

const minimumGapMs = 2000;
const batchDelayMs = 250;
const maxReconnectDelayMs = 30_000;

function resourcesFor(kind: string): readonly ResourceKind[] {
	return kind === 'all' ? allResourceKinds : (kindResources[kind] ?? []);
}

function createInvalidator() {
	const revisions = new Map<string, EnvironmentChanges>();
	const pending = new Map<string, number>();
	const lastRun = new Map<string, number>();
	let seeded = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const flush = () => {
		timer = undefined;
		const now = Date.now();
		const mutations = useResourceMutationStore.getState();
		let reloadsEnvironments = false;
		for (const [key, at] of pending) {
			if (at > now) continue;
			pending.delete(key);
			lastRun.set(key, now);
			const separator = key.indexOf('\u001f');
			const environmentID = key.slice(0, separator);
			const kind = key.slice(separator + 1);
			if (kind === 'all') ResponseCache.invalidateEnvironment(environmentID);
			for (const resource of resourcesFor(kind)) {
				if (resource === 'environments') reloadsEnvironments = true;
				mutations.markChanged(resource, resource === 'environments' ? undefined : environmentID);
			}
		}
		const environments = useEnvironmentsStore.getState();
		if (reloadsEnvironments && environments.hasLoaded)
			void environments.load({ refresh: true, loadsEnvironmentDetails: false });
		schedule();
	};

	const schedule = () => {
		if (timer !== undefined || pending.size === 0) return;
		timer = setTimeout(flush, Math.max(0, Math.min(...pending.values()) - Date.now()));
	};

	const queue = (environmentID: string, kinds: string[]) => {
		const now = Date.now();
		for (const kind of kinds) {
			const key = `${environmentID}\u001f${kind}`;
			if (pending.has(key)) continue;
			pending.set(key, Math.max(now + batchDelayMs, (lastRun.get(key) ?? 0) + minimumGapMs));
		}
		schedule();
	};

	return {
		apply(changes: EnvironmentChanges[]) {
			for (const change of changes) {
				const known = revisions.get(change.environmentID);
				revisions.set(change.environmentID, change);
				if (!seeded) continue;
				if (known && known.epoch !== change.epoch) {
					queue(change.environmentID, ['all']);
					continue;
				}
				const rose = Object.keys(change.kinds).filter(
					(kind) => (change.kinds[kind] ?? 0) > (known?.kinds[kind] ?? 0)
				);
				if (rose.length > 0) queue(change.environmentID, rose);
			}
			seeded = true;
		},
		reset() {
			if (timer !== undefined) clearTimeout(timer);
			timer = undefined;
			revisions.clear();
			pending.clear();
			lastRun.clear();
			seeded = false;
		}
	};
}

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

async function watchChanges(
	client: ArcaneClient,
	signal: AbortSignal,
	invalidator: ReturnType<typeof createInvalidator>
): Promise<void> {
	const scoped = client.withSignal(signal);
	let attempt = 0;
	while (!signal.aborted) {
		const connectedAt = Date.now();
		try {
			for await (const event of scoped.events.changesStream()) {
				if (signal.aborted) return;
				if (event.changes.length > 0) invalidator.apply(event.changes);
			}
		} catch (error) {
			if (isCancellation(error) || signal.aborted) return;
		}
		if (Date.now() - connectedAt > 10_000) attempt = 0;
		attempt += 1;
		await wait(Math.min(maxReconnectDelayMs, 1000 * 2 ** Math.min(attempt, 5)), signal);
	}
}

export function startEnvironmentChangeWatcher(): () => void {
	const invalidator = createInvalidator();
	let controller: AbortController | undefined;
	let watchedTransport: object | undefined;
	let foreground = AppState.currentState === 'active';

	const stop = () => {
		controller?.abort();
		controller = undefined;
		watchedTransport = undefined;
		invalidator.reset();
	};

	const update = () => {
		const { authState, apiGeneration, client } = useClientManager.getState();
		const shouldWatch =
			foreground && authState === 'authenticated' && apiGeneration === 'v3' && client;
		if (!shouldWatch) {
			stop();
			return;
		}
		if (watchedTransport === client.transport && controller) return;
		stop();
		const next = new AbortController();
		controller = next;
		watchedTransport = client.transport;
		void watchChanges(client, next.signal, invalidator);
	};

	const unsubscribe = useClientManager.subscribe((state, previous) => {
		if (
			state.authState !== previous.authState ||
			state.apiGeneration !== previous.apiGeneration ||
			state.client !== previous.client
		)
			update();
	});
	const appState = AppState.addEventListener('change', (state) => {
		const next = state === 'active';
		if (next === foreground) return;
		foreground = next;
		update();
	});
	update();
	return () => {
		unsubscribe();
		appState.remove();
		stop();
	};
}
