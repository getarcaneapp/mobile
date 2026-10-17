import { RemoteDataLimits, boundedData } from '@/core/networking/remote-data-limits';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { parseArcaneJSON } from '@/sdk/http/json';
import { ContainerDetails } from '@/sdk/models/container/ContainerDetails';

function inspectPath(client: ArcaneClient, environmentID: EnvironmentID, containerID: string) {
	return client.rest.environmentPath(
		environmentID,
		`containers/${encodeURIComponent(containerID)}`
	);
}

async function readEnvelope(
	client: ArcaneClient,
	environmentID: EnvironmentID,
	containerID: string
) {
	const data = await boundedData(client, inspectPath(client, environmentID, containerID), {
		maximumBytes: RemoteDataLimits.maximumInspectBytes
	});
	const envelope = parseArcaneJSON(new TextDecoder().decode(data)) as { data?: unknown };
	return envelope.data;
}

export async function boundedContainerInspect(
	client: ArcaneClient,
	environmentID: EnvironmentID,
	containerID: string
) {
	return ContainerDetails.decode(await readEnvelope(client, environmentID, containerID));
}

export async function boundedContainerInspectWithAutoUpdate(
	client: ArcaneClient,
	environmentID: EnvironmentID,
	containerID: string
): Promise<{ details: ContainerDetails; autoUpdateEnabled?: boolean }> {
	const raw = await readEnvelope(client, environmentID, containerID);
	const flag = (raw as { autoUpdateEnabled?: unknown } | undefined)?.autoUpdateEnabled;
	return {
		details: ContainerDetails.decode(raw),
		autoUpdateEnabled: typeof flag === 'boolean' ? flag : undefined
	};
}
