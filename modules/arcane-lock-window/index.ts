import { NativeModule, requireOptionalNativeModule } from 'expo';

export type LockWindowOptions = {
	enabled: boolean;
	locked: boolean;
	busy: boolean;
	buttonTitle: string;
	symbol: string;
	tintHex?: string;
};

type ArcaneLockWindowEvents = { onUnlockPress: () => void };

declare class ArcaneLockWindowNativeModule extends NativeModule<ArcaneLockWindowEvents> {
	update(options: LockWindowOptions): Promise<void>;
}

const native = requireOptionalNativeModule<ArcaneLockWindowNativeModule>('ArcaneLockWindow');

export const ArcaneLockWindow = {
	isLinked: native !== null,

	update(options: LockWindowOptions) {
		void native?.update(options).catch(() => {});
	},

	addUnlockListener(listener: () => void): () => void {
		if (!native) return () => {};
		const subscription = native.addListener('onUnlockPress', listener);
		return () => subscription.remove();
	}
};
