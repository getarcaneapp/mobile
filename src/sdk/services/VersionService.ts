import type { EnvironmentID } from '../client/environment';
import type { QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { VersionCheck, VersionInfo } from '../models/version/VersionInfo';

export class VersionService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

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

	async appVersion(): Promise<VersionInfo> {
		const text = await this.rest.transport.rawRequest('app-version', {
			method: 'GET',
			authorized: false
		});
		const info = this.rest.transport.decode<VersionInfo>(text);
		this.rest.transport.authManager.recordEnabledFeatures(info.enabledFeatures ?? []);
		return info;
	}

	environmentVersion(args: { envID?: EnvironmentID } = {}): Promise<VersionInfo> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'version'));
	}
}
