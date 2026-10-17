/** Port of Services/SettingsService.swift. */
import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import type { SettingCategory } from '../models/category/Category';
import type { SettingsSearchResponse } from '../models/search/Search';
import type { PublicSetting, SettingDto, UpdateSettings } from '../models/settings/Settings';

/** Manages application settings, search, and category metadata. */
export class SettingsService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - Per-environment settings

	/**
	 * Get all public settings for an environment (no auth required). The
	 * endpoint returns the list directly without an `APIResponse` envelope.
	 */
	async getPublicSettings(args: { envID?: EnvironmentID } = {}): Promise<PublicSetting[]> {
		const path = this.rest.environmentPath(args.envID, 'settings/public');
		const text = await this.rest.transport.rawRequest(path, { authorized: false });
		return this.rest.transport.decode<PublicSetting[]>(text);
	}

	/**
	 * Get all settings visible to the current user for an environment. The
	 * endpoint returns the list directly without an `APIResponse` envelope.
	 */
	async getSettings(args: { envID?: EnvironmentID } = {}): Promise<PublicSetting[]> {
		const path = this.rest.environmentPath(args.envID, 'settings');
		const text = await this.rest.transport.rawRequest(path);
		return this.rest.transport.decode<PublicSetting[]>(text);
	}

	/** Update settings for an environment. */
	updateSettings(args: { body: UpdateSettings; envID?: EnvironmentID }): Promise<SettingDto[]> {
		return this.rest.put(this.rest.environmentPath(args.envID, 'settings'), { body: args.body });
	}

	// MARK: - Top-level settings (search & categories)

	/**
	 * Search settings categories and individual settings by query. The
	 * endpoint returns the response directly without an `APIResponse` envelope.
	 */
	async search(args: { query: string }): Promise<SettingsSearchResponse> {
		const text = await this.rest.transport.rawRequest('settings/search', {
			method: 'POST',
			body: { query: args.query }
		});
		return this.rest.transport.decode<SettingsSearchResponse>(text);
	}

	/**
	 * Get all available settings categories with metadata. The endpoint
	 * returns the list directly without an `APIResponse` envelope.
	 */
	async categories(): Promise<SettingCategory[]> {
		const text = await this.rest.transport.rawRequest('settings/categories');
		return this.rest.transport.decode<SettingCategory[]>(text);
	}
}
