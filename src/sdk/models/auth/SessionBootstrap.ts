import { normalizeV3Environment } from '../../client/v3Responses';
import type { PaginatedResponse } from '../../pagination/PaginatedResponse';
import { D } from '../base/decoding';
import type { PaginationResponse } from '../base/pagination';
import type { Environment } from '../environment/EnvironmentModel';
import { PermissionsManifest } from '../role/PermissionsManifest';
import { User } from '../user/User';
import type { VersionInfo } from '../version/VersionInfo';

export interface SessionBootstrap {
	user: User;
	version: VersionInfo;
	environments: PaginatedResponse<Environment>;
	permissionsManifest: PermissionsManifest;
}

export const SessionBootstrap = {
	decode(this: void, raw: unknown): SessionBootstrap {
		const o = D.object(raw, 'SessionBootstrap');
		const environments = D.object(o.environments, 'SessionBootstrap.environments');
		return {
			user: D.nested(o, 'user', User.decode),
			version: D.nested(o, 'version', D.cast<VersionInfo>),
			environments: {
				success: true,
				data: (Array.isArray(environments.data) ? environments.data : []).map(
					(environment) => normalizeV3Environment(environment) as Environment
				),
				pagination: D.nested(environments, 'pagination', D.cast<PaginationResponse>)
			},
			permissionsManifest: D.nested(o, 'permissionsManifest', PermissionsManifest.decode)
		};
	}
} as const;
