/** Port of Services/WebhooksService.swift: webhook resources scoped to an environment. */
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

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** List all webhooks configured for an environment. Tokens are masked. */
	list(args: { envID?: EnvironmentID } = {}): Promise<Webhook[]> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'webhooks'));
	}

	/** Create a new webhook. The raw token is returned only on creation. */
	create(args: { body: CreateWebhook; envID?: EnvironmentID }): Promise<WebhookCreated> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'webhooks'), { body: args.body });
	}

	/** Update a webhook's enabled state. */
	async update(args: { id: string; body: UpdateWebhook; envID?: EnvironmentID }): Promise<void> {
		await this.rest.patch(this.rest.environmentPath(args.envID, `webhooks/${args.id}`), {
			body: args.body,
			decode: MessageResponse.decode
		});
	}

	/** Delete a webhook. */
	delete(args: { id: string; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(this.rest.environmentPath(args.envID, `webhooks/${args.id}`));
	}
}
