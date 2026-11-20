import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';

const groups = [
	['pruneContainerMode', 'pruneContainerUntil'],
	['pruneImageMode', 'pruneImageUntil'],
	['pruneNetworkMode', 'pruneNetworkUntil'],
	['pruneVolumeMode'],
	['pruneBuildCacheMode', 'pruneBuildCacheUntil']
] as const;

export type PruneSettingKey = (typeof groups)[number][number];
export type PruneDefaults = Partial<Record<PruneSettingKey, string>>;

export function agreedPruneDefaults(
	environments: readonly ReadonlyMap<string, string>[]
): PruneDefaults {
	const defaults: PruneDefaults = {};
	const [first, ...rest] = environments;
	if (!first) return defaults;
	for (const group of groups) {
		if (!group.every((key) => rest.every((values) => values.get(key) === first.get(key)))) continue;
		for (const key of group) {
			const value = first.get(key);
			if (value !== undefined) defaults[key] = value;
		}
	}
	return defaults;
}

async function environmentValues(
	client: ArcaneClient,
	environmentID: EnvironmentID
): Promise<Map<string, string>> {
	const settings = await client.settings
		.getSettings({ envID: environmentID })
		.catch(() => client.settings.getPublicSettings({ envID: environmentID }));
	return new Map(settings.map((setting) => [setting.key, setting.value]));
}

export async function loadPruneDefaults(
	client: ArcaneClient,
	environmentIDs: readonly EnvironmentID[]
): Promise<PruneDefaults> {
	return Promise.all(environmentIDs.map((id) => environmentValues(client, id))).then(
		agreedPruneDefaults,
		(): PruneDefaults => ({})
	);
}
