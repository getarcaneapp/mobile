/** Port of Services/OidcRoleMappingsService.swift. */
import type { RESTService } from '../http/RESTService';
import type {
	CreateOidcRoleMapping,
	OidcRoleMapping,
	UpdateOidcRoleMapping
} from '../models/role/OidcRoleMapping';

/**
 * OidcRoleMappingsService manages OIDC claim-value → role mappings.
 * Mappings with `source == "env"` are declared via the
 * `OIDC_ROLE_MAPPINGS` env var and are read-only at runtime (update/delete
 * against them return 403). Available only on v2 RBAC servers.
 */
export class OidcRoleMappingsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** List every OIDC role mapping. Not paginated. */
	list(): Promise<OidcRoleMapping[]> {
		return this.rest.get('oidc/role-mappings');
	}

	create(args: { body: CreateOidcRoleMapping }): Promise<OidcRoleMapping> {
		return this.rest.post('oidc/role-mappings', { body: args.body });
	}

	update(args: { id: string; body: UpdateOidcRoleMapping }): Promise<OidcRoleMapping> {
		return this.rest.put(`oidc/role-mappings/${args.id}`, { body: args.body });
	}

	/**
	 * The server answers `{ success: true }` with no `data`, so this skips the
	 * usual `MessageResponse` decode (which made a successful delete report an
	 * error). Non-2xx responses still throw.
	 */
	async delete(args: { id: string }): Promise<void> {
		await this.rest.delete(`oidc/role-mappings/${args.id}`, { decode: () => undefined });
	}
}
