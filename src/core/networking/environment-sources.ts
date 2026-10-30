import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { EnvironmentID } from '@/sdk/client/environment';

export type EnvironmentSource<Environment extends { id: EnvironmentID }> = {
	key: string;
	environments: Environment[];
};

const defaultAggregateLimit = 64;
const limits = new WeakMap<object, Promise<number>>();

function aggregateLimit(client: ArcaneClient): Promise<number> {
	const known = limits.get(client.transport);
	if (known) return known;
	const loaded = client.settings
		.getPublicSettings({ envID: EnvironmentID.localDocker })
		.then((settings) => {
			const value = Number(settings.find((s) => s.key === 'allEnvironmentsLimit')?.value);
			return Number.isFinite(value) && value >= 2 ? Math.floor(value) : defaultAggregateLimit;
		})
		.catch(() => {
			limits.delete(client.transport);
			return defaultAggregateLimit;
		});
	limits.set(client.transport, loaded);
	return loaded;
}

export function singleEnvironmentSources<Environment extends { id: EnvironmentID }>(
	environments: readonly Environment[]
): EnvironmentSource<Environment>[] {
	return environments.map((environment) => ({ key: environment.id, environments: [environment] }));
}

export async function environmentSources<Environment extends { id: EnvironmentID }>(
	client: ArcaneClient | undefined,
	environments: readonly Environment[]
): Promise<EnvironmentSource<Environment>[]> {
	if (!client || environments.length < 2 || (await client.apiGeneration()) !== 'v3')
		return singleEnvironmentSources(environments);
	const limit = await aggregateLimit(client);
	const sources: EnvironmentSource<Environment>[] = [];
	for (let start = 0; start < environments.length; start += limit) {
		const chunk = environments.slice(start, start + limit);
		sources.push({
			key: chunk.map((environment) => environment.id).join(','),
			environments: chunk
		});
	}
	return sources;
}
