import { NativeModule, requireOptionalNativeModule } from 'expo';

export type CloudSyncStatus = {
	available: boolean;
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

	getAllItems(service: string, options: CloudItemOptions = {}): Promise<Record<string, string>> {
		if (!native) return Promise.reject(unavailable());
		return native.getAllItems(service, options.accessGroup ?? null);
	},

	listAccounts(service: string, options: CloudItemOptions = {}): Promise<string[]> {
		if (!native) return Promise.reject(unavailable());
		return native.listAccounts(service, options.accessGroup ?? null);
	},

	savePassword: async (username: string, password: string): Promise<boolean> =>
		native?.savePassword ? native.savePassword(username, password) : false,

	getPassword: async (): Promise<{ username: string; password: string } | undefined> =>
		(native?.getPassword ? await native.getPassword() : null) ?? undefined
};
