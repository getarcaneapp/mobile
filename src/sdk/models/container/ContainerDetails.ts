import { D } from '../base/decoding';
import type { PaginationResponse } from '../base/pagination';
import {
	ContainerNetworkSettings,
	type ContainerHostConfig,
	type ContainerMount,
	type ContainerPort
} from './Container';
import type { ContainerComposeInfo, ContainerConfig, ContainerState } from './ContainerState';
import {
	ContainerStatusCounts,
	ContainerSummaryGroup,
	decodeLossyContainerSummaryArray,
	type ContainerSummary
} from './ContainerSummary';

export interface ContainerDetails {
	id: string;
	name: string;
	image: string;
	imageId: string;
	created: string;
	state: ContainerState;
	config: ContainerConfig;
	hostConfig: ContainerHostConfig;
	networkSettings: ContainerNetworkSettings;
	ports: ContainerPort[];
	mounts: ContainerMount[];
	labels?: Record<string, string>;
	composeInfo?: ContainerComposeInfo;
	iconLightUrl?: string;
	iconDarkUrl?: string;
	redeployDisabled?: boolean;
	activityID?: string;
}

export const ContainerDetails = {
	make(
		this: void,
		init: Partial<ContainerDetails> & Pick<ContainerDetails, 'id'>
	): ContainerDetails {
		return {
			...init,
			name: init.name ?? '',
			image: init.image ?? '',
			imageId: init.imageId ?? '',
			created: init.created ?? '',
			state: init.state ?? { status: '', running: false },
			config: init.config ?? {},
			hostConfig: init.hostConfig ?? {},
			networkSettings: init.networkSettings ?? ContainerNetworkSettings.make(),
			ports: init.ports ?? [],
			mounts: init.mounts ?? []
		};
	},

	decode(this: void, raw: unknown): ContainerDetails {
		const o = D.object(raw, 'ContainerDetails');
		return {
			id: D.string(o, 'id'),
			name: D.string(o, 'name'),
			image: D.string(o, 'image'),
			imageId: D.string(o, 'imageId'),
			created: D.string(o, 'created'),
			state: D.nested(o, 'state', D.cast<ContainerState>),
			config: D.nested(o, 'config', D.cast<ContainerConfig>),
			hostConfig: D.nested(o, 'hostConfig', D.cast<ContainerHostConfig>),
			networkSettings: D.nested(o, 'networkSettings', ContainerNetworkSettings.decode),
			ports: D.array(o, 'ports', D.cast<ContainerPort>),
			mounts: D.array(o, 'mounts', D.cast<ContainerMount>),
			labels: D.optRecord(o, 'labels', D.str),
			composeInfo: D.optNested(o, 'composeInfo', D.cast<ContainerComposeInfo>),
			iconLightUrl: D.optString(o, 'iconLightUrl'),
			iconDarkUrl: D.optString(o, 'iconDarkUrl'),
			redeployDisabled: D.optBoolean(o, 'redeployDisabled'),
			activityID: D.optString(o, 'activityId')
		};
	},

	encode(this: void, value: ContainerDetails): Record<string, unknown> {
		const { activityID, ...rest } = value;
		return { ...rest, activityId: activityID };
	}
} as const;

export interface ContainerListResponse {
	success: boolean;
	data: ContainerSummary[];
	groups?: ContainerSummaryGroup[];
	counts: ContainerStatusCounts;
	pagination: PaginationResponse;
	resourceSortSupported: boolean;
}

export const ContainerListResponse = {
	make(
		this: void,
		init: Partial<ContainerListResponse> & Pick<ContainerListResponse, 'success' | 'pagination'>
	): ContainerListResponse {
		return {
			...init,
			data: init.data ?? [],
			counts: init.counts ?? ContainerStatusCounts.make(),
			resourceSortSupported: init.resourceSortSupported ?? false
		};
	},

	decode(this: void, raw: unknown): ContainerListResponse {
		const o = D.object(raw, 'ContainerListResponse');
		return {
			success: D.boolean(o, 'success'),
			data: D.nested(o, 'data', decodeLossyContainerSummaryArray),
			groups: D.optArray(o, 'groups', ContainerSummaryGroup.decode),
			counts: D.nested(o, 'counts', D.cast<ContainerStatusCounts>),
			pagination: D.nested(o, 'pagination', D.cast<PaginationResponse>),
			resourceSortSupported: D.optBoolean(o, 'resourceSortSupported') ?? false
		};
	}
} as const;
