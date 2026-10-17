import { NativeModule, requireOptionalNativeModule } from 'expo';

/**
 * Platform cloud storage for small items.
 *
 * - iOS: synchronizable generic-password keychain items (iCloud Keychain).
 *   `accessGroup` / `accessible` select the keychain group and protection class.
 * - Android: Google Play services Block Store (backup restored on new-device
 *   setup, not a live sync); `accessGroup` / `accessible` are ignored. Password
 *   sign-ins use Credential Manager (`savePassword` / `getPassword`).
 *
 * Neither platform emits a change notification: refresh on foreground.
 */
export type CloudSyncStatus = {
	/** The store can be read and written. */
	available: boolean;
	/** Items leave the device (iCloud Keychain, or end-to-end encrypted Google backup). */
	cloudBackup: boolean;
};

export type KeychainAccessibility = 'afterFirstUnlock' | 'whenUnlocked';

export type CloudItemOptions = {
	accessGroup?: string;
	accessible?: KeychainAccessibility;
};

declare class ArcaneCloudSyncNativeModule extends NativeModule {
	getStatus(): Promise<CloudSyncStatus>;
	getItem(service: string, account: string, accessGroup: string | null): Promise<string | null>;
	setItem(
		service: string,
		account: string,
		value: string,
		accessGroup: string | null,
		accessible: string | null
	): Promise<void>;
	deleteItem(service: string, account: string, accessGroup: string | null): Promise<void>;
	getAllItems(service: string, accessGroup: string | null): Promise<Record<string, string>>;
	listAccounts(service: string, accessGroup: string | null): Promise<string[]>;
	savePassword?(username: string, password: string): Promise<boolean>;
	getPassword?(): Promise<{ username: string; password: string } | null>;
}

// Optional so a dev client built before this module existed keeps working
// with local-only storage instead of crashing.
const native = requireOptionalNativeModule<ArcaneCloudSyncNativeModule>('ArcaneCloudSync');

const unavailable = () => new Error("ArcaneCloudSync native module isn't in this build");

export const ArcaneCloudSync = {
	isLinked: native !== null,

	getStatus: (): Promise<CloudSyncStatus> =>
		native ? native.getStatus() : Promise.resolve({ available: false, cloudBackup: false }),

	async getItem(
		service: string,
		account: string,
		options: CloudItemOptions = {}
	): Promise<string | undefined> {
		if (!native) throw unavailable();
		return (await native.getItem(service, account, options.accessGroup ?? null)) ?? undefined;
	},

	setItem(
		service: string,
		account: string,
		value: string,
		options: CloudItemOptions = {}
	): Promise<void> {
		if (!native) return Promise.reject(unavailable());
		return native.setItem(
			service,
			account,
			value,
			options.accessGroup ?? null,
			options.accessible ?? null
		);
	},

	deleteItem(service: string, account: string, options: CloudItemOptions = {}): Promise<void> {
		if (!native) return Promise.reject(unavailable());
		return native.deleteItem(service, account, options.accessGroup ?? null);
	},

	/** account → value for every item under `service`. */
	getAllItems(service: string, options: CloudItemOptions = {}): Promise<Record<string, string>> {
		if (!native) return Promise.reject(unavailable());
		return native.getAllItems(service, options.accessGroup ?? null);
	},

	listAccounts(service: string, options: CloudItemOptions = {}): Promise<string[]> {
		if (!native) return Promise.reject(unavailable());
		return native.listAccounts(service, options.accessGroup ?? null);
	},

	/** Android: offers to save to Google Password Manager. Resolves false when dismissed or unsupported. */
	savePassword: async (username: string, password: string): Promise<boolean> =>
		native?.savePassword ? native.savePassword(username, password) : false,

	/** Android: lets the user pick a saved password for this app. Undefined when dismissed or none. */
	getPassword: async (): Promise<{ username: string; password: string } | undefined> =>
		(native?.getPassword ? await native.getPassword() : null) ?? undefined
};
