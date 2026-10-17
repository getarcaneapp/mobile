/** Port of Services/VariablesService.swift. Manager-level global-variable management. */
import type { RESTService } from '../http/RESTService';
import type { ArcaneRequestOptions } from '../http/requestOptions';
import { decodeArray } from '../models/base/decoding';
import {
	CreateGlobalVariableRequest,
	EnvironmentSyncStatus,
	GlobalVariable,
	GlobalVariableMutationResponse,
	UpdateGlobalVariableRequest
} from '../models/variable/Variable';

export class VariablesService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	list(): Promise<GlobalVariable[]> {
		return this.rest.get('variables', { decode: decodeArray(GlobalVariable.decode) });
	}

	create(args: {
		request: CreateGlobalVariableRequest;
		options?: ArcaneRequestOptions;
	}): Promise<GlobalVariableMutationResponse> {
		return this.rest.post('variables', {
			body: CreateGlobalVariableRequest.encode(args.request),
			options: args.options,
			decode: GlobalVariableMutationResponse.decode
		});
	}

	update(args: {
		id: string;
		request: UpdateGlobalVariableRequest;
		options?: ArcaneRequestOptions;
	}): Promise<GlobalVariableMutationResponse> {
		return this.rest.put(`variables/${args.id}`, {
			body: UpdateGlobalVariableRequest.encode(args.request),
			options: args.options,
			decode: GlobalVariableMutationResponse.decode
		});
	}

	delete(args: {
		id: string;
		options?: ArcaneRequestOptions;
	}): Promise<GlobalVariableMutationResponse> {
		return this.rest.delete(`variables/${args.id}`, {
			options: args.options,
			decode: GlobalVariableMutationResponse.decode
		});
	}

	sync(args: { options?: ArcaneRequestOptions } = {}): Promise<EnvironmentSyncStatus[]> {
		return this.rest.post('variables/sync', {
			options: args.options,
			decode: decodeArray(EnvironmentSyncStatus.decode)
		});
	}

	syncStatus(): Promise<EnvironmentSyncStatus[]> {
		return this.rest.get('variables/sync-status', {
			decode: decodeArray(EnvironmentSyncStatus.decode)
		});
	}
}
