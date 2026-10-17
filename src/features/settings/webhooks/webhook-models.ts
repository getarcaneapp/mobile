import type { WebhookCreated } from '@/sdk/models/webhook/Webhook';

export type WebhookTargetType = 'container' | 'project' | 'updater' | 'gitops';
export type WebhookActionType =
	| 'update'
	| 'start'
	| 'stop'
	| 'restart'
	| 'redeploy'
	| 'up'
	| 'down'
	| 'run'
	| 'sync';

export const webhookTargetTypes: { value: WebhookTargetType; title: string }[] = [
	{ value: 'container', title: 'Container' },
	{ value: 'project', title: 'Project' },
	{ value: 'updater', title: 'Updater' },
	{ value: 'gitops', title: 'GitOps' }
];

export function actionsForTarget(targetType: WebhookTargetType): WebhookActionType[] {
	switch (targetType) {
		case 'container':
			return ['update', 'start', 'stop', 'restart', 'redeploy'];
		case 'project':
			return ['update', 'up', 'down', 'restart', 'redeploy'];
		case 'updater':
			return ['run'];
		case 'gitops':
			return ['sync'];
	}
}

export type CreateWebhookPayload = { onCreated: (created: WebhookCreated) => void };
export type WebhookTokenPayload = { name: string; token: string };
