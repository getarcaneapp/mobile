import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import type { SettingCategory } from '../models/category/Category';
import type { SettingsSearchResponse } from '../models/search/Search';
import { BrandImageSlot } from '../models/settings/BrandImage';
import type { PublicSetting, SettingDto, UpdateSettings } from '../models/settings/Settings';

export type GlobalSettingsScope = 'manager' | 'authentication';

const GLOBAL_SETTINGS_PATHS: Record<GlobalSettingsScope, string> = {
	manager: 'settings',
	authentication: 'settings/authentication'
};

export class SettingsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	async getPublicSettings(args: { envID?: EnvironmentID } = {}): Promise<PublicSetting[]> {
		const path = this.rest.environmentPath(args.envID, 'settings/public');
		const text = await this.rest.transport.rawRequest(path, { authorized: false });
		return this.rest.transport.decode<PublicSetting[]>(text);
	}

	async getSettings(args: { envID?: EnvironmentID } = {}): Promise<PublicSetting[]> {
		const path = this.rest.environmentPath(args.envID, 'settings');
		const text = await this.rest.transport.rawRequest(path);
		return this.rest.transport.decode<PublicSetting[]>(text);
	}

	updateSettings(args: { body: UpdateSettings; envID?: EnvironmentID }): Promise<SettingDto[]> {
		return this.rest.put(this.rest.environmentPath(args.envID, 'settings'), { body: args.body });
	}

	async getGlobalSettings(args: { scope: GlobalSettingsScope }): Promise<PublicSetting[]> {
		const text = await this.rest.transport.rawRequest(GLOBAL_SETTINGS_PATHS[args.scope]);
		return this.rest.transport.decode<PublicSetting[]>(text);
	}

	async updateGlobalSettings(args: {
		scope: GlobalSettingsScope;
		body: Record<string, string>;
	}): Promise<void> {
		await this.rest.transport.rawRequest(GLOBAL_SETTINGS_PATHS[args.scope], {
			method: 'PATCH',
			body: args.body
		});
	}

	async search(args: { query: string }): Promise<SettingsSearchResponse> {
		const text = await this.rest.transport.rawRequest('settings/search', {
			method: 'POST',
			body: { query: args.query }
		});
		return this.rest.transport.decode<SettingsSearchResponse>(text);
	}

	async categories(): Promise<SettingCategory[]> {
		const text = await this.rest.transport.rawRequest('settings/categories');
		return this.rest.transport.decode<SettingCategory[]>(text);
	}

	async uploadBrandImage(args: {
		slot: BrandImageSlot;
		fileURL: string;
		filename: string;
		contentType?: string;
	}): Promise<void> {
		await this.rest.transport.multipartUpload(BrandImageSlot.uploadPath(args.slot), {
			method: 'PUT',
			files: [
				{
					fieldName: 'file',
					filename: args.filename,
					uri: args.fileURL,
					contentType: args.contentType
				}
			],
			decode: () => undefined
		});
	}

	deleteBrandImage(args: { slot: BrandImageSlot }): Promise<void> {
		return this.rest.deleteVoid(BrandImageSlot.uploadPath(args.slot));
	}
}
