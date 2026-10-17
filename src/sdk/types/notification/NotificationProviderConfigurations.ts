/**
 * Port of Types/Notification/NotificationProviderConfigurations.swift.
 *
 * Each configuration is a synthesized `Codable` struct; they carry a `decode`
 * / `encode` because the nested `NotificationEvents` maps its keys to
 * snake_case. `make(...)` applies the Swift init defaults (notably
 * `events = NotificationEvents.defaults`).
 */
import { D, type RawObject } from '../../models/base/decoding';
import {
	EmailAuthMode,
	EmailTLSMode,
	NotificationEvents
} from '../../models/notification/Notification';

function decodeEvents(o: RawObject): NotificationEvents | undefined {
	return D.optNested(o, 'events', NotificationEvents.decode);
}

function encodeEvents(events: NotificationEvents | undefined): Record<string, unknown> | undefined {
	return events === undefined ? undefined : NotificationEvents.encode(events);
}

/**
 * `events` is defaulted only when the caller omits the key; passing
 * `events: undefined` explicitly mirrors Swift `events: nil`.
 */
function eventsDefault(init: { events?: NotificationEvents }): NotificationEvents | undefined {
	return 'events' in init ? init.events : NotificationEvents.defaults;
}

// MARK: - Discord

export interface DiscordNotificationConfiguration {
	webhookId: string;
	token?: string;
	username?: string;
	avatarUrl?: string;
	events?: NotificationEvents;
}

export const DiscordNotificationConfiguration = {
	make(init: DiscordNotificationConfiguration): DiscordNotificationConfiguration {
		return { ...init, events: eventsDefault(init) };
	},
	decode(raw: unknown): DiscordNotificationConfiguration {
		const o = D.object(raw, 'DiscordNotificationConfiguration');
		return {
			webhookId: D.string(o, 'webhookId'),
			token: D.optString(o, 'token'),
			username: D.optString(o, 'username'),
			avatarUrl: D.optString(o, 'avatarUrl'),
			events: decodeEvents(o)
		};
	},
	encode(value: DiscordNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Email

export interface EmailNotificationConfiguration {
	smtpHost: string;
	smtpPort: number;
	smtpUsername: string;
	smtpPassword?: string;
	fromAddress: string;
	toAddresses: string[];
	tlsMode: EmailTLSMode;
	authMode?: EmailAuthMode;
	events?: NotificationEvents;
}

export const EmailNotificationConfiguration = {
	/** Defaults: `authMode = "auto"`, `events = NotificationEvents.defaults` (when the key is omitted). */
	make(init: EmailNotificationConfiguration): EmailNotificationConfiguration {
		return {
			...init,
			authMode: 'authMode' in init ? init.authMode : 'auto',
			events: eventsDefault(init)
		};
	},
	decode(raw: unknown): EmailNotificationConfiguration {
		const o = D.object(raw, 'EmailNotificationConfiguration');
		return {
			smtpHost: D.string(o, 'smtpHost'),
			smtpPort: D.int(o, 'smtpPort'),
			smtpUsername: D.string(o, 'smtpUsername'),
			smtpPassword: D.optString(o, 'smtpPassword'),
			fromAddress: D.string(o, 'fromAddress'),
			toAddresses: D.array(o, 'toAddresses', D.str),
			tlsMode: D.nested(o, 'tlsMode', EmailTLSMode.decode),
			authMode: D.optNested(o, 'authMode', EmailAuthMode.decode),
			events: decodeEvents(o)
		};
	},
	encode(value: EmailNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Telegram

export interface TelegramNotificationConfiguration {
	botToken?: string;
	chatIds: string[];
	preview: boolean;
	notification: boolean;
	parseMode?: string;
	title?: string;
	events?: NotificationEvents;
}

export const TelegramNotificationConfiguration = {
	/** Defaults: `preview = true`, `notification = true`. */
	make(
		init: Omit<TelegramNotificationConfiguration, 'preview' | 'notification'> & {
			preview?: boolean;
			notification?: boolean;
		}
	): TelegramNotificationConfiguration {
		return {
			...init,
			preview: init.preview ?? true,
			notification: init.notification ?? true,
			events: eventsDefault(init)
		};
	},
	decode(raw: unknown): TelegramNotificationConfiguration {
		const o = D.object(raw, 'TelegramNotificationConfiguration');
		return {
			botToken: D.optString(o, 'botToken'),
			chatIds: D.array(o, 'chatIds', D.str),
			preview: D.boolean(o, 'preview'),
			notification: D.boolean(o, 'notification'),
			parseMode: D.optString(o, 'parseMode'),
			title: D.optString(o, 'title'),
			events: decodeEvents(o)
		};
	},
	encode(value: TelegramNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Signal

export interface SignalNotificationConfiguration {
	host: string;
	port: number;
	user?: string;
	password?: string;
	token?: string;
	source: string;
	recipients: string[];
	disableTls: boolean;
	events?: NotificationEvents;
}

export const SignalNotificationConfiguration = {
	/** Defaults: `disableTls = false`. */
	make(
		init: Omit<SignalNotificationConfiguration, 'disableTls'> & { disableTls?: boolean }
	): SignalNotificationConfiguration {
		return { ...init, disableTls: init.disableTls ?? false, events: eventsDefault(init) };
	},
	decode(raw: unknown): SignalNotificationConfiguration {
		const o = D.object(raw, 'SignalNotificationConfiguration');
		return {
			host: D.string(o, 'host'),
			port: D.int(o, 'port'),
			user: D.optString(o, 'user'),
			password: D.optString(o, 'password'),
			token: D.optString(o, 'token'),
			source: D.string(o, 'source'),
			recipients: D.array(o, 'recipients', D.str),
			disableTls: D.boolean(o, 'disableTls'),
			events: decodeEvents(o)
		};
	},
	encode(value: SignalNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Slack

export interface SlackNotificationConfiguration {
	token?: string;
	botName?: string;
	icon?: string;
	color?: string;
	title?: string;
	channel?: string;
	threadTs?: string;
	events?: NotificationEvents;
}

export const SlackNotificationConfiguration = {
	make(init: SlackNotificationConfiguration = {}): SlackNotificationConfiguration {
		return { ...init, events: eventsDefault(init) };
	},
	decode(raw: unknown): SlackNotificationConfiguration {
		const o = D.object(raw, 'SlackNotificationConfiguration');
		return {
			token: D.optString(o, 'token'),
			botName: D.optString(o, 'botName'),
			icon: D.optString(o, 'icon'),
			color: D.optString(o, 'color'),
			title: D.optString(o, 'title'),
			channel: D.optString(o, 'channel'),
			threadTs: D.optString(o, 'threadTs'),
			events: decodeEvents(o)
		};
	},
	encode(value: SlackNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Ntfy

export interface NtfyNotificationConfiguration {
	host: string;
	port: number;
	topic: string;
	username?: string;
	password?: string;
	title?: string;
	priority?: string;
	tags?: string[];
	icon?: string;
	cache: boolean;
	firebase: boolean;
	disableTls: boolean;
	disableTlsVerification: boolean;
	events?: NotificationEvents;
}

export const NtfyNotificationConfiguration = {
	/** Defaults: `cache = true`, `firebase = true`, `disableTls = false`, `disableTlsVerification = false`. */
	make(
		init: Omit<
			NtfyNotificationConfiguration,
			'cache' | 'firebase' | 'disableTls' | 'disableTlsVerification'
		> & {
			cache?: boolean;
			firebase?: boolean;
			disableTls?: boolean;
			disableTlsVerification?: boolean;
		}
	): NtfyNotificationConfiguration {
		return {
			...init,
			cache: init.cache ?? true,
			firebase: init.firebase ?? true,
			disableTls: init.disableTls ?? false,
			disableTlsVerification: init.disableTlsVerification ?? false,
			events: eventsDefault(init)
		};
	},
	decode(raw: unknown): NtfyNotificationConfiguration {
		const o = D.object(raw, 'NtfyNotificationConfiguration');
		return {
			host: D.string(o, 'host'),
			port: D.int(o, 'port'),
			topic: D.string(o, 'topic'),
			username: D.optString(o, 'username'),
			password: D.optString(o, 'password'),
			title: D.optString(o, 'title'),
			priority: D.optString(o, 'priority'),
			tags: D.optArray(o, 'tags', D.str),
			icon: D.optString(o, 'icon'),
			cache: D.boolean(o, 'cache'),
			firebase: D.boolean(o, 'firebase'),
			disableTls: D.boolean(o, 'disableTls'),
			disableTlsVerification: D.boolean(o, 'disableTlsVerification'),
			events: decodeEvents(o)
		};
	},
	encode(value: NtfyNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Pushover

export interface PushoverNotificationConfiguration {
	token?: string;
	user: string;
	devices?: string[];
	priority: number;
	title?: string;
	events?: NotificationEvents;
}

export const PushoverNotificationConfiguration = {
	/** Defaults: `priority = 0`. */
	make(
		init: Omit<PushoverNotificationConfiguration, 'priority'> & { priority?: number }
	): PushoverNotificationConfiguration {
		return { ...init, priority: init.priority ?? 0, events: eventsDefault(init) };
	},
	decode(raw: unknown): PushoverNotificationConfiguration {
		const o = D.object(raw, 'PushoverNotificationConfiguration');
		return {
			token: D.optString(o, 'token'),
			user: D.string(o, 'user'),
			devices: D.optArray(o, 'devices', D.str),
			priority: D.int(o, 'priority'),
			title: D.optString(o, 'title'),
			events: decodeEvents(o)
		};
	},
	encode(value: PushoverNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Gotify

export interface GotifyNotificationConfiguration {
	host: string;
	port?: number;
	token?: string;
	path?: string;
	priority?: number;
	title?: string;
	disableTls: boolean;
	insecureSkipVerify: boolean;
	useHeader: boolean;
	events?: NotificationEvents;
}

export const GotifyNotificationConfiguration = {
	/** Defaults: `disableTls`, `insecureSkipVerify`, `useHeader` = `false`. */
	make(
		init: Omit<
			GotifyNotificationConfiguration,
			'disableTls' | 'insecureSkipVerify' | 'useHeader'
		> & {
			disableTls?: boolean;
			insecureSkipVerify?: boolean;
			useHeader?: boolean;
		}
	): GotifyNotificationConfiguration {
		return {
			...init,
			disableTls: init.disableTls ?? false,
			insecureSkipVerify: init.insecureSkipVerify ?? false,
			useHeader: init.useHeader ?? false,
			events: eventsDefault(init)
		};
	},
	decode(raw: unknown): GotifyNotificationConfiguration {
		const o = D.object(raw, 'GotifyNotificationConfiguration');
		return {
			host: D.string(o, 'host'),
			port: D.optInt(o, 'port'),
			token: D.optString(o, 'token'),
			path: D.optString(o, 'path'),
			priority: D.optInt(o, 'priority'),
			title: D.optString(o, 'title'),
			disableTls: D.boolean(o, 'disableTls'),
			insecureSkipVerify: D.boolean(o, 'insecureSkipVerify'),
			useHeader: D.boolean(o, 'useHeader'),
			events: decodeEvents(o)
		};
	},
	encode(value: GotifyNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Matrix

export interface MatrixNotificationConfiguration {
	host: string;
	port?: number;
	rooms: string;
	username?: string;
	password?: string;
	disableTlsVerification: boolean;
	events?: NotificationEvents;
}

export const MatrixNotificationConfiguration = {
	/** Defaults: `disableTlsVerification = false`. */
	make(
		init: Omit<MatrixNotificationConfiguration, 'disableTlsVerification'> & {
			disableTlsVerification?: boolean;
		}
	): MatrixNotificationConfiguration {
		return {
			...init,
			disableTlsVerification: init.disableTlsVerification ?? false,
			events: eventsDefault(init)
		};
	},
	decode(raw: unknown): MatrixNotificationConfiguration {
		const o = D.object(raw, 'MatrixNotificationConfiguration');
		return {
			host: D.string(o, 'host'),
			port: D.optInt(o, 'port'),
			rooms: D.string(o, 'rooms'),
			username: D.optString(o, 'username'),
			password: D.optString(o, 'password'),
			disableTlsVerification: D.boolean(o, 'disableTlsVerification'),
			events: decodeEvents(o)
		};
	},
	encode(value: MatrixNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Google Chat

export interface GoogleChatNotificationConfiguration {
	webhookUrl?: string;
	events?: NotificationEvents;
}

export const GoogleChatNotificationConfiguration = {
	make(init: GoogleChatNotificationConfiguration = {}): GoogleChatNotificationConfiguration {
		return { ...init, events: eventsDefault(init) };
	},
	decode(raw: unknown): GoogleChatNotificationConfiguration {
		const o = D.object(raw, 'GoogleChatNotificationConfiguration');
		return {
			webhookUrl: D.optString(o, 'webhookUrl'),
			events: decodeEvents(o)
		};
	},
	encode(value: GoogleChatNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;

// MARK: - Generic webhook

export interface GenericNotificationConfiguration {
	webhookUrl: string;
	method?: string;
	contentType?: string;
	titleKey?: string;
	messageKey?: string;
	customHeaders?: Record<string, string>;
	disableTls: boolean;
	events?: NotificationEvents;
	successBodyContains?: string;
	payloadTemplate?: string;
}

export const GenericNotificationConfiguration = {
	/** Defaults: `disableTls = false`. */
	make(
		init: Omit<GenericNotificationConfiguration, 'disableTls'> & { disableTls?: boolean }
	): GenericNotificationConfiguration {
		return { ...init, disableTls: init.disableTls ?? false, events: eventsDefault(init) };
	},
	decode(raw: unknown): GenericNotificationConfiguration {
		const o = D.object(raw, 'GenericNotificationConfiguration');
		return {
			webhookUrl: D.string(o, 'webhookUrl'),
			method: D.optString(o, 'method'),
			contentType: D.optString(o, 'contentType'),
			titleKey: D.optString(o, 'titleKey'),
			messageKey: D.optString(o, 'messageKey'),
			customHeaders: D.optRecord(o, 'customHeaders', D.str),
			disableTls: D.boolean(o, 'disableTls'),
			events: decodeEvents(o),
			successBodyContains: D.optString(o, 'successBodyContains'),
			payloadTemplate: D.optString(o, 'payloadTemplate')
		};
	},
	encode(value: GenericNotificationConfiguration): Record<string, unknown> {
		return { ...value, events: encodeEvents(value.events) };
	}
} as const;
