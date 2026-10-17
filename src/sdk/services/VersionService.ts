/** Port of Services/VersionService.swift. */
import type { EnvironmentID } from '../client/environment';
import type { QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { VersionCheck, VersionInfo } from '../models/version/VersionInfo';

/**
 * Facade for the version endpoints.
 *
 * `/version` and `/app-version` return their payloads *without* the standard
 * `{success, data}` envelope, so they go through `rawRequest` and decode the
 * body directly. `/environments/{id}/version` is wrapped normally.
 */
export class VersionService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/**
	 * Returns a simplified version check, optionally comparing against a
	 * caller-supplied `current` version.
	 */
	async check(args: { current?: string } = {}): Promise<VersionCheck> {
		const query: QueryItem[] = [];
		if (args.current !== undefined) query.push({ name: 'current', value: args.current });
		const text = await this.rest.transport.rawRequest('version', {
			method: 'GET',
			query,
			authorized: false
		});
		return this.rest.transport.decode<VersionCheck>(text);
	}

	/**
	 * Returns the full application version info for the local API server and
	 * records its `enabledFeatures` as server capabilities.
	 */
	async appVersion(): Promise<VersionInfo> {
		const text = await this.rest.transport.rawRequest('app-version', {
			method: 'GET',
			authorized: false
		});
		const info = this.rest.transport.decode<VersionInfo>(text);
		this.rest.transport.authManager.recordEnabledFeatures(info.enabledFeatures ?? []);
		return info;
	}

	/** Returns the application version info for a remote environment. */
	environmentVersion(args: { envID?: EnvironmentID } = {}): Promise<VersionInfo> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'version'));
	}
}
