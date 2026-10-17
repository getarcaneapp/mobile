/**
 * Port of Services/NotificationsService.swift: notification provider
 * settings, Apprise integration, and dispatch.
 */
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

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	// MARK: - Provider settings

	/** Get all notification settings for an environment. */
	listSettings(args: { envID?: EnvironmentID } = {}): Promise<NotificationSettings[]> {
		return this.rawRequest(
			this.rest.environmentPath(args.envID, 'notifications/settings'),
			decodeArray(NotificationSettings.decode)
		);
	}

	/** Get notification settings for a specific provider. */
	getSettings(args: {
		provider: NotificationProvider;
		envID?: EnvironmentID;
	}): Promise<NotificationSettings> {
		return this.rawRequest(
			this.rest.environmentPath(args.envID, `notifications/settings/${args.provider}`),
			NotificationSettings.decode
		);
	}

	/** Create or update notification settings. */
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

	/** Delete notification settings for a provider. */
	deleteSettings(args: { provider: NotificationProvider; envID?: EnvironmentID }): Promise<void> {
		return this.rest.deleteVoid(
			this.rest.environmentPath(args.envID, `notifications/settings/${args.provider}`)
		);
	}

	/** Send a test notification through the configured provider. */
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

	// MARK: - Apprise

	/** Get the Apprise integration settings. */
	getAppriseSettings(args: { envID?: EnvironmentID } = {}): Promise<AppriseSettings> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'notifications/apprise'));
	}

	/** Create or update Apprise integration settings. */
	upsertAppriseSettings(args: {
		body: UpdateAppriseSettings;
		envID?: EnvironmentID;
	}): Promise<AppriseSettings> {
		return this.rest.post(this.rest.environmentPath(args.envID, 'notifications/apprise'), {
			body: args.body
		});
	}

	/** Send a test notification through Apprise. */
	testApprise(args: { type?: NotificationTestType; envID?: EnvironmentID } = {}): Promise<void> {
		return this.rest.postVoid(this.rest.environmentPath(args.envID, 'notifications/apprise/test'), {
			query: [{ name: 'type', value: args.type ?? 'simple' }]
		});
	}

	// MARK: - Dispatch (manager-facing endpoint)

	/** Dispatch a notification from a remote agent to the manager. */
	dispatch(args: { body: NotificationDispatchRequest }): Promise<void> {
		return this.rest.postVoid('notifications/dispatch', { body: args.body });
	}

	/** These endpoints return their body directly (no `APIResponse` envelope). */
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
