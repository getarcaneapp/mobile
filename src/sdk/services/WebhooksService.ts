import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import { MessageResponse } from '../models/base/message';
import type {
	CreateWebhook,
	UpdateWebhook,
	Webhook,
	WebhookCreated
} from '../models/webhook/Webhook';

export class WebhooksService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	list(args: { envID?: EnvironmentID } = {}): Promise<Webhook[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'webhooks'));
	}

	create(args: { body: CreateWebhook; envID?: EnvironmentID }): Promise<WebhookCreated> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'webhooks'), { body: args.body });
	}

	async update(args: { id: string; body: UpdateWebhook; envID?: EnvironmentID }): Promise<void> {
		await this.rest.patch(this.rest.environmentPath(args.envID, `webhooks/${args.id}`), {
			body: args.body,
			decode: MessageResponse.decode
		});
	}

	delete(args: { id: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, `webhooks/${args.id}`));
	}
}
