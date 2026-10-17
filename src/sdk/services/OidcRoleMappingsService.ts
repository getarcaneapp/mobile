import type { RESTService } from '../http/RESTService';
import type {
	CreateOidcRoleMapping,
	OidcRoleMapping,
	UpdateOidcRoleMapping
} from '../models/role/OidcRoleMapping';

export class OidcRoleMappingsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	list(): Promise<OidcRoleMapping[]> {
		return this.rest.get('oidc/role-mappings');
	}

	create(args: { body: CreateOidcRoleMapping }): Promise<OidcRoleMapping> {
		return this.rest.post('oidc/role-mappings', { body: args.body });
	}

	update(args: { id: string; body: UpdateOidcRoleMapping }): Promise<OidcRoleMapping> {
		return this.rest.put(`oidc/role-mappings/${args.id}`, { body: args.body });
	}

	async delete(args: { id: string }): Promise<void> {
		await this.rest.delete(`oidc/role-mappings/${args.id}`, { decode: () => undefined });
	}
}
