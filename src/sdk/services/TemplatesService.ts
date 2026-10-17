import type { EnvironmentID } from '../client/environment';
import { q, type QueryItem } from '../client/url';
import type { RESTService } from '../http/RESTService';
import type { SortOrder } from '../models/base/pagination';
import type { EnvVariable, EnvVariables } from '../models/env/Env';
import {
	RemoteTemplateRegistry,
	TemplateSourceFilter,
	type CreateTemplate,
	type CreateTemplateRegistry,
	type DefaultTemplates,
	type SaveDefaultTemplates,
	type Template,
	type TemplateContent,
	type TemplateRegistry,
	type UpdateTemplate,
	type UpdateTemplateRegistry
} from '../models/template/Template';
import type { PaginatedResponse } from '../pagination/PaginatedResponse';

export class TemplatesService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	listPaginated(
		args: {
			search?: string;
			sort?: string;
			order?: SortOrder;
			start?: number;
			limit?: number;
			type?: string;
			source?: TemplateSourceFilter;
		} = {}
	): Promise<PaginatedResponse<Template>> {
		const query: QueryItem[] = [];
		if (args.search !== undefined) query.push(q('search', args.search));
		if (args.sort !== undefined) query.push(q('sort', args.sort));
		if (args.order !== undefined) query.push(q('order', args.order));
		const source = TemplateSourceFilter.queryValue(args.source ?? 'all');
		if (args.type !== undefined) {
			query.push(q('type', args.type));
		} else if (source !== undefined) {
			query.push(q('type', source));
		}
		return this.rest.transport.paginated('templates', {
			start: args.start ?? 0,
			limit: args.limit ?? 20,
			query
		});
	}

	listAll(): Promise<Template[]> {
		return this.rest.get('templates/all');
	}

	get(args: { id: string }): Promise<Template> {
		return this.rest.get(`templates/${args.id}`);
	}

	getContent(args: { id: string }): Promise<TemplateContent> {
		return this.rest.get(`templates/${args.id}/content`);
	}

	create(args: { body: CreateTemplate }): Promise<Template> {
		return this.rest.post('templates', { body: args.body });
	}

	update(args: { id: string; body: UpdateTemplate }): Promise<Template> {
		return this.rest.put(`templates/${args.id}`, { body: args.body });
	}

	delete(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`templates/${args.id}`);
	}

	download(args: { id: string }): Promise<Template> {
		return this.rest.post(`templates/${args.id}/download`);
	}

	getDefaults(): Promise<DefaultTemplates> {
		return this.rest.get('templates/default');
	}

	saveDefaults(args: { body: SaveDefaultTemplates }): Promise<void> {
		return this.rest.postVoid('templates/default', { body: args.body });
	}

	listRegistries(): Promise<TemplateRegistry[]> {
		return this.rest.get('templates/registries');
	}

	createRegistry(args: { body: CreateTemplateRegistry }): Promise<TemplateRegistry> {
		return this.rest.post('templates/registries', { body: args.body });
	}

	updateRegistry(args: { id: string; body: UpdateTemplateRegistry }): Promise<void> {
		return this.rest.putVoid(`templates/registries/${args.id}`, { body: args.body });
	}

	deleteRegistry(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`templates/registries/${args.id}`);
	}

	fetchRegistry(args: { url: string }): Promise<RemoteTemplateRegistry> {
		return this.rest.get('templates/fetch', {
			query: [q('url', args.url)],
			decode: RemoteTemplateRegistry.decode
		});
	}

	getGlobalVariables(args: { envID?: EnvironmentID } = {}): Promise<EnvVariable[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'templates/variables'));
	}

	updateGlobalVariables(args: { variables: EnvVariable[]; envID?: EnvironmentID }): Promise<void> {
		const body: EnvVariables = { variables: args.variables };
		return this.rest.putVoid(this.rest.environmentPath(args.envID, 'templates/variables'), {
			body
		});
	}
}
