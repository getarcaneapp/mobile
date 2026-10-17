import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerListResponse } from '@/sdk/models/container/ContainerDetails';
import type { ContainerResourceSample } from '@/sdk/models/container/ContainerSummary';

type Samples = ReadonlyMap<string, ReadonlyMap<string, ContainerResourceSample>>;

function sameSamples(
	a: ReadonlyMap<string, ContainerResourceSample> | undefined,
	b: ReadonlyMap<string, ContainerResourceSample>
) {
	if (!a || a.size !== b.size) return false;
	for (const [id, sample] of b) {
		const other = a.get(id);
		if (
			!other ||
			other.cpuPercent !== sample.cpuPercent ||
			other.memoryUsageBytes !== sample.memoryUsageBytes ||
			other.memoryLimitBytes !== sample.memoryLimitBytes ||
			other.sampleTime !== sample.sampleTime
		) {
			return false;
		}
	}
	return true;
}

export class ContainerResourceSampleStore {
	static readonly refreshIntervalMs = 5_000;

	private samples: Samples = new Map();
	private unsupported = new Set<EnvironmentID>();
	revision = 0;
	private listeners = new Set<() => void>();

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getRevision = () => this.revision;

	private changed() {
		this.revision += 1;
		for (const listener of this.listeners) listener();
	}

	sample(containerID: string, environmentID: EnvironmentID): ContainerResourceSample | undefined {
		return this.samples.get(environmentID)?.get(containerID);
	}

	supports(environmentID: EnvironmentID): boolean {
		return !this.unsupported.has(environmentID);
	}

	isPending(environmentID: EnvironmentID): boolean {
		return !this.samples.has(environmentID) && !this.unsupported.has(environmentID);
	}

	async refresh(client: ArcaneClient, environments: readonly EnvironmentID[]): Promise<void> {
		const targets = environments.filter((id) => !this.unsupported.has(id));
		if (targets.length === 0) return;
		const results = await Promise.all(
			targets.map(
				async (environmentID): Promise<[EnvironmentID, ContainerListResponse | undefined]> => {
					try {
						const response = await client.containers.list({
							envID: environmentID,
							query: { limit: -1, sortBy: 'cpuUsage', sortOrder: 'desc' },
							includeHidden: true
						});
						return [environmentID, response];
					} catch {
						return [environmentID, undefined];
					}
				}
			)
		);
		let didChange = false;
		const next = new Map(this.samples);
		for (const [environmentID, response] of results) {
			if (!response) continue;
			if (!response.resourceSortSupported) {
				this.unsupported.add(environmentID);
				next.delete(environmentID);
				didChange = true;
				continue;
			}
			const byID = new Map<string, ContainerResourceSample>();
			for (const container of response.data) {
				if (container.resourceSample) byID.set(container.id, container.resourceSample);
			}
			if (!sameSamples(next.get(environmentID), byID)) {
				next.set(environmentID, byID);
				didChange = true;
			}
		}
		if (didChange) {
			this.samples = next;
			this.changed();
		}
	}
}
