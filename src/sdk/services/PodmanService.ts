import type { EnvironmentID } from '../client/environment';
import { boolString, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import { decodeArray } from '../models/base/decoding';
import {
	KubeDownReport,
	KubeGenerateResponse,
	KubePlayReport,
	type KubeDownRequest,
	type KubeGenerateRequest,
	type KubePlayRequest
} from '../models/podman/Kube';
import { Pod, PodInspect, PodPruneReport, PodTop, type PodAction } from '../models/podman/Pod';
import {
	PodmanAutoUpdateResult,
	type PodmanAutoUpdateOptions
} from '../models/podman/PodmanAutoUpdate';
import {
	PodmanSecret,
	type PodmanSecretCreateRequest,
	type PodmanSecretCreateResponse,
	type PodmanSecretUpdateRequest
} from '../models/podman/PodmanSecret';
import { PodmanStatus, PodmanUnitStatus } from '../models/podman/PodmanStatus';
import {
	QuadletDetail,
	QuadletFile,
	QuadletInstallReport,
	QuadletRemoveReport,
	type QuadletAction,
	type QuadletInstallRequest,
	type QuadletUpdateRequest
} from '../models/podman/Quadlet';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export interface PodmanListArgs {
	envID?: EnvironmentID;
	search?: string;
	start?: number;
	limit?: number;
}

export class PodmanService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	private path(envID: EnvironmentID | undefined, suffix: string): string {
		return this.rest.environmentPath(envID, `podman/${suffix}`);
	}

	private list<T>(
		suffix: string,
		args: PodmanListArgs,
		decode: (raw: unknown) => T
	): Promise<PaginatedResponse<T>> {
		const query: QueryItem[] = [];
		if (args.search !== undefined) query.push({ name: 'search', value: args.search });
		return this.rest.paginated<T>(this.path(args.envID, suffix), {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query,
			decode
		});
	}

	status(args: { envID?: EnvironmentID } = {}): Promise<PodmanStatus> {
		return this.rest.get(this.path(args.envID, 'status'), { decode: PodmanStatus.decode });
	}

	runAutoUpdate(
		args: { options?: PodmanAutoUpdateOptions; envID?: EnvironmentID } = {}
	): Promise<PodmanAutoUpdateResult> {
		return this.rest.post(this.path(args.envID, 'autoupdate'), {
			body: args.options ?? {},
			decode: PodmanAutoUpdateResult.decode
		});
	}

	listPods(args: PodmanListArgs = {}): Promise<PaginatedResponse<Pod>> {
		return this.list('pods', args, Pod.decode);
	}

	pod(args: { podId: string; envID?: EnvironmentID }): Promise<PodInspect> {
		return this.rest.get(this.path(args.envID, `pods/${args.podId}`), {
			decode: PodInspect.decode
		});
	}

	podTop(args: { podId: string; envID?: EnvironmentID }): Promise<PodTop> {
		return this.rest.get(this.path(args.envID, `pods/${args.podId}/top`), {
			decode: PodTop.decode
		});
	}

	podAction(args: { podId: string; action: PodAction; envID?: EnvironmentID }): Promise<void> {
		return this.rest.postVoid(this.path(args.envID, `pods/${args.podId}`), {
			body: {},
			query: [{ name: 'action', value: args.action }]
		});
	}

	removePod(args: { podId: string; force?: boolean; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.path(args.envID, `pods/${args.podId}`), {
			query: [{ name: 'force', value: boolString(args.force ?? false) }]
		});
	}

	prunePods(args: { envID?: EnvironmentID } = {}): Promise<PodPruneReport[]> {
		return this.rest.post(this.path(args.envID, 'pods/prune'), {
			body: {},
			decode: (raw) =>
				raw === undefined || raw === null ? [] : decodeArray(PodPruneReport.decode)(raw)
		});
	}

	listQuadlets(args: PodmanListArgs = {}): Promise<PaginatedResponse<QuadletDetail>> {
		return this.list('quadlets', args, QuadletDetail.decode);
	}

	quadlet(args: { name: string; envID?: EnvironmentID }): Promise<QuadletDetail> {
		return this.rest.get(this.path(args.envID, `quadlets/${args.name}`), {
			decode: QuadletDetail.decode
		});
	}

	quadletFile(args: { name: string; envID?: EnvironmentID }): Promise<QuadletFile> {
		return this.rest.get(this.path(args.envID, `quadlets/${args.name}/file`), {
			decode: QuadletFile.decode
		});
	}

	installQuadlet(args: {
		request: QuadletInstallRequest;
		envID?: EnvironmentID;
	}): Promise<QuadletInstallReport> {
		return this.rest.post(this.path(args.envID, 'quadlets'), {
			body: args.request,
			decode: QuadletInstallReport.decode
		});
	}

	updateQuadlet(args: {
		name: string;
		request: QuadletUpdateRequest;
		envID?: EnvironmentID;
	}): Promise<QuadletInstallReport> {
		return this.rest.put(this.path(args.envID, `quadlets/${args.name}`), {
			body: args.request,
			decode: QuadletInstallReport.decode
		});
	}

	removeQuadlet(args: { name: string; envID?: EnvironmentID }): Promise<QuadletRemoveReport> {
		return this.rest.delete(this.path(args.envID, `quadlets/${args.name}`), {
			decode: QuadletRemoveReport.decode
		});
	}

	quadletAction(args: {
		name: string;
		action: QuadletAction;
		envID?: EnvironmentID;
	}): Promise<PodmanUnitStatus> {
		return this.rest.post(this.path(args.envID, `quadlets/${args.name}`), {
			body: {},
			query: [{ name: 'action', value: args.action }],
			decode: PodmanUnitStatus.decode
		});
	}

	kubePlay(args: { request: KubePlayRequest; envID?: EnvironmentID }): Promise<KubePlayReport> {
		return this.rest.post(this.path(args.envID, 'kube/play'), {
			body: args.request,
			decode: KubePlayReport.decode
		});
	}

	kubeDown(args: { request: KubeDownRequest; envID?: EnvironmentID }): Promise<KubeDownReport> {
		return this.rest.post(this.path(args.envID, 'kube/down'), {
			body: args.request,
			decode: KubeDownReport.decode
		});
	}

	kubeGenerate(args: {
		request: KubeGenerateRequest;
		envID?: EnvironmentID;
	}): Promise<KubeGenerateResponse> {
		return this.rest.post(this.path(args.envID, 'kube/generate'), {
			body: args.request,
			decode: KubeGenerateResponse.decode
		});
	}

	listSecrets(args: PodmanListArgs = {}): Promise<PaginatedResponse<PodmanSecret>> {
		return this.list('secrets', args, PodmanSecret.decode);
	}

	createSecret(args: {
		request: PodmanSecretCreateRequest;
		envID?: EnvironmentID;
	}): Promise<PodmanSecretCreateResponse> {
		return this.rest.post(this.path(args.envID, 'secrets'), { body: args.request });
	}

	updateSecret(args: {
		name: string;
		request: PodmanSecretUpdateRequest;
		envID?: EnvironmentID;
	}): Promise<PodmanSecret> {
		return this.rest.put(this.path(args.envID, `secrets/${args.name}`), {
			body: args.request,
			decode: PodmanSecret.decode
		});
	}

	removeSecret(args: { secretId: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.path(args.envID, `secrets/${args.secretId}`));
	}
}
