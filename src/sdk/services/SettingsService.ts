import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import type { SettingCategory } from '../models/category/Category';
import type { SettingsSearchResponse } from '../models/search/Search';
import type { PublicSetting, SettingDto, UpdateSettings } from '../models/settings/Settings';

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
}
