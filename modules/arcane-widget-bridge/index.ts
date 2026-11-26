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

export type SpotlightItem = { id: string; title: string; subtitle: string; kind: string };

type ArcaneWidgetBridgeEvents = { onLink: (event: { url: string }) => void };

declare class ArcaneWidgetBridgeNativeModule extends NativeModule<ArcaneWidgetBridgeEvents> {
	writeSnapshot(json: string, reload: boolean): Promise<boolean>;
	writeSharedFile(name: string, json: string): Promise<boolean>;
	indexSpotlight(items: SpotlightItem[]): Promise<void>;
	clearSpotlight(): Promise<void>;
	takePendingLink(): string | null;
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

	writeSharedFile: async (name: string, json: string): Promise<boolean> =>
		native ? native.writeSharedFile(name, json) : false,

	indexSpotlight: async (items: SpotlightItem[]): Promise<void> => {
		if (native) await native.indexSpotlight(items);
	},

	clearSpotlight: async (): Promise<void> => {
		if (native) await native.clearSpotlight();
	},

	takePendingLink: (): string | undefined => native?.takePendingLink() ?? undefined,

	addLinkListener: (listener: (url: string) => void): (() => void) => {
		if (!native) return () => {};
		const subscription = native.addListener('onLink', (event) => listener(event.url));
		return () => subscription.remove();
	},

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
