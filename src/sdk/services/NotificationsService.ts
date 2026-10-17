import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import type { Decoder } from '../models/base/decoding';
import { decodeArray } from '../models/base/decoding';
import {
	NotificationSettings,
	UpdateNotificationSettings,
	type AppriseSettings,
	type NotificationDispatchRequest,
	type NotificationProvider,
	type NotificationTestResponse,
	type NotificationTestType,
	type UpdateAppriseSettings
} from '../models/notification/Notification';

export class NotificationsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	listSettings(args: { envID?: EnvironmentID } = {}): Promise<NotificationSettings[]> {
		return this.rawRequest(
			this.rest.environmentPath(args.envID, 'notifications/settings'),
			decodeArray(NotificationSettings.decode)
		);
	}

	getSettings(args: {
		provider: NotificationProvider;
		envID?: EnvironmentID;
	}): Promise<NotificationSettings> {
		return this.rawRequest(
			this.rest.environmentPath(args.envID, `notifications/settings/${args.provider}`),
			NotificationSettings.decode
		);
	}

	upsertSettings(args: {
		body: UpdateNotificationSettings;
		envID?: EnvironmentID;
	}): Promise<NotificationSettings> {
		return this.rawRequest(
			this.rest.environmentPath(args.envID, 'notifications/settings'),
			NotificationSettings.decode,
			'POST',
			UpdateNotificationSettings.encode(args.body)
		);
	}

	deleteSettings(args: { provider: NotificationProvider; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `notifications/settings/${args.provider}`)
		);
	}

	test(args: {
		provider: NotificationProvider;
		type?: NotificationTestType;
		envID?: EnvironmentID;
	}): Promise<NotificationTestResponse> {
		return this.rest.post(
			this.rest.environmentPath(args.envID, `notifications/test/${args.provider}`),
			{
				query: [{ name: 'type', value: args.type ?? 'simple' }]
			}
		);
	}

	getAppriseSettings(args: { envID?: EnvironmentID } = {}): Promise<AppriseSettings> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'notifications/apprise'));
	}

	upsertAppriseSettings(args: {
		body: UpdateAppriseSettings;
		envID?: EnvironmentID;
	}): Promise<AppriseSettings> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'notifications/apprise'), {
			body: args.body
		});
	}

	testApprise(args: { type?: NotificationTestType; envID?: EnvironmentID } = {}): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'notifications/apprise/test'), {
			query: [{ name: 'type', value: args.type ?? 'simple' }]
		});
	}

	dispatch(args: { body: NotificationDispatchRequest }): Promise<void> {
		return this.rest.postVoid('notifications/dispatch', { body: args.body });
	}

	private async rawRequest<T>(
		path: string,
		decode: Decoder<T>,
		method = 'GET',
		body?: unknown
	): Promise<T> {
		const text = await this.rest.transport.rawRequest(path, { method, body });
		return this.rest.transport.decode(text, decode);
	}
}
