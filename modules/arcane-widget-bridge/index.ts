import { NativeModule, requireOptionalNativeModule } from 'expo';

export type LiveActivityRunState = 'running' | 'success' | 'failure';

export type LiveActivityAttributes = {
	title: string;
	symbolName: string;
	environmentName: string;
};

export type LiveActivityContentState = {
	phase: string;
	progress?: number;
	state: LiveActivityRunState;
	detail?: string;
};

declare class ArcaneWidgetBridgeNativeModule extends NativeModule {
	writeSnapshot(json: string, reload: boolean): Promise<boolean>;
	areActivitiesEnabled(): boolean;
	startActivity(
		attributes: LiveActivityAttributes,
		state: LiveActivityContentState
	): Promise<string | null>;
	updateActivity(id: string, state: LiveActivityContentState): Promise<void>;
	endActivity(
		id: string,
		state: LiveActivityContentState | null,
		lingerSeconds: number
	): Promise<void>;
	endAllActivities(): Promise<void>;
}

const native = requireOptionalNativeModule<ArcaneWidgetBridgeNativeModule>('ArcaneWidgetBridge');

export const ArcaneWidgetBridge = {
	isLinked: native !== null,

	writeSnapshot: async (json: string, reload: boolean): Promise<boolean> =>
		native ? native.writeSnapshot(json, reload) : false,

	areActivitiesEnabled: (): boolean => native?.areActivitiesEnabled() ?? false,

	startActivity: async (
		attributes: LiveActivityAttributes,
		state: LiveActivityContentState
	): Promise<string | undefined> =>
		(native ? await native.startActivity(attributes, state) : null) ?? undefined,

	updateActivity: async (id: string, state: LiveActivityContentState): Promise<void> => {
		if (native) await native.updateActivity(id, state);
	},

	endActivity: async (
		id: string,
		state: LiveActivityContentState | undefined,
		lingerSeconds: number
	): Promise<void> => {
		if (native) await native.endActivity(id, state ?? null, lingerSeconds);
	},

	endAllActivities: async (): Promise<void> => {
		if (native) await native.endAllActivities();
	}
};
