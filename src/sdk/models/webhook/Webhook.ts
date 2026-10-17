/** Port of Models/Webhook/Webhook.swift. */
import type { ISODateString } from '../base/date';

/** Summary is returned in list responses; the token is masked. */
export interface Webhook {
	id: string;
	name: string;
	tokenPrefix: string;
	targetType: string;
	actionType: string;
	targetId: string;
	targetName?: string;
	environmentId: string;
	enabled: boolean;
	lastTriggeredAt?: ISODateString;
	createdAt: ISODateString;
}

/** Returned once when a webhook is first created, including the raw token. */
export interface WebhookCreated {
	id: string;
	name: string;
	token: string;
	targetType: string;
	actionType: string;
	targetId: string;
	createdAt: ISODateString;
}

export interface CreateWebhook {
	name: string;
	targetType: string;
	actionType: string;
	targetId: string;
}

export interface UpdateWebhook {
	enabled: boolean;
}
