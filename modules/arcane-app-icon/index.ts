import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class ArcaneAppIconNativeModule extends NativeModule {
	readonly alternateIconNames: string[];
	getSupportsAlternateIcons(): Promise<boolean>;
	getAlternateIconName(): Promise<string | null>;
	setAlternateIconName(name: string | null): Promise<void>;
}

const native = requireOptionalNativeModule<ArcaneAppIconNativeModule>('ArcaneAppIcon');

export const ArcaneAppIcon = {
	isLinked: native !== null,

	alternateIconNames: native?.alternateIconNames ?? [],

	supportsAlternateIcons: async (): Promise<boolean> =>
		native ? native.getSupportsAlternateIcons() : false,

	getAlternateIconName: async (): Promise<string | undefined> =>
		(native ? await native.getAlternateIconName() : null) ?? undefined,

	setAlternateIconName(name: string | undefined): Promise<void> {
		if (!native)
			return Promise.reject(new Error("Alternate app icons aren't available in this build."));
		return native.setAlternateIconName(name ?? null);
	}
};
