import { NativeModule, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type FirebaseOptions = {
	projectId: string;
	applicationId: string;
	apiKey: string;
	senderId: string;
};

export type FirebaseApplyResult = 'applied' | 'restart' | 'failed';

declare class ArcaneFirebaseNativeModule extends NativeModule {
	getOptions(): FirebaseOptions | null;
	isInitialized(): boolean;
	setOptions(
		projectId: string,
		applicationId: string,
		apiKey: string,
		senderId: string
	): Promise<FirebaseApplyResult>;
	clearOptions(): Promise<FirebaseApplyResult>;
	restart(): void;
}

const native =
	Platform.OS === 'android'
		? requireOptionalNativeModule<ArcaneFirebaseNativeModule>('ArcaneFirebase')
		: null;

export const ArcaneFirebase = {
	isLinked: native !== null,

	getOptions: (): FirebaseOptions | undefined => native?.getOptions() ?? undefined,

	isInitialized: (): boolean => native?.isInitialized() ?? false,

	async setOptions(options: FirebaseOptions): Promise<FirebaseApplyResult> {
		if (!native) return 'failed';
		return native.setOptions(
			options.projectId,
			options.applicationId,
			options.apiKey,
			options.senderId
		);
	},

	async clearOptions(): Promise<FirebaseApplyResult> {
		return native ? native.clearOptions() : 'failed';
	},

	restart() {
		native?.restart();
	}
};
