/** Port of Models/Notification/Notification.swift. */
import type { JSONValue } from '../../types/json';
import {
	DiscordNotificationConfiguration,
	EmailNotificationConfiguration,
	GenericNotificationConfiguration,
	GoogleChatNotificationConfiguration,
	GotifyNotificationConfiguration,
	MatrixNotificationConfiguration,
	NtfyNotificationConfiguration,
	PushoverNotificationConfiguration,
	SignalNotificationConfiguration,
	SlackNotificationConfiguration,
	TelegramNotificationConfiguration
} from '../../types/notification/NotificationProviderConfigurations';
import { D, DecodingError } from '../base/decoding';

/** Swift `RawRepresentable` enum decoding: unknown raw values are an error. */
function strictEnumDecoder<T extends string>(
	cases: readonly T[],
	name: string
): (raw: unknown) => T {
	return (raw) => {
		const value = D.str(raw);
		if (!(cases as readonly string[]).includes(value)) {
			throw new DecodingError(`Cannot initialize ${name} from invalid String value ${value}`);
		}
		return value as T;
	};
}

// MARK: - NotificationProvider

/** Identifiers for notification providers. */
export type NotificationProvider =
	| 'discord'
	| 'email'
	| 'telegram'
	| 'signal'
	| 'slack'
	| 'ntfy'
	| 'pushover'
	| 'gotify'
	| 'matrix'
	| 'googlechat'
	| 'generic';

const notificationProviderCases = [
	'discord',
	'email',
	'telegram',
	'signal',
	'slack',
	'ntfy',
	'pushover',
	'gotify',
	'matrix',
	'googlechat',
	'generic'
] as const satisfies readonly NotificationProvider[];

export const NotificationProvider = {
	discord: 'discord',
	email: 'email',
	telegram: 'telegram',
	signal: 'signal',
	slack: 'slack',
	ntfy: 'ntfy',
	pushover: 'pushover',
	gotify: 'gotify',
	matrix: 'matrix',
	googlechat: 'googlechat',
	generic: 'generic',
	allCases: notificationProviderCases,
	decode: strictEnumDecoder<NotificationProvider>(notificationProviderCases, 'NotificationProvider')
} as const;

// MARK: - NotificationEvents

export interface NotificationEvents {
	imageUpdate: boolean;
	containerUpdate: boolean;
	vulnerabilityFound: boolean;
	pruneReport: boolean;
	autoHeal: boolean;
}

function makeNotificationEvents(init: Partial<NotificationEvents> = {}): NotificationEvents {
	return {
		imageUpdate: init.imageUpdate ?? true,
		containerUpdate: init.containerUpdate ?? true,
		vulnerabilityFound: init.vulnerabilityFound ?? true,
		pruneReport: init.pruneReport ?? false,
		autoHeal: init.autoHeal ?? false
	};
}

export const NotificationEvents = {
	/** Swift init defaults: update/vulnerability events on, prune/auto-heal off. */
	make: makeNotificationEvents,
	defaults: makeNotificationEvents(),
	allEnabled: makeNotificationEvents({ pruneReport: true, autoHeal: true }),

	/** Swift `init(from:)`: snake_case keys, missing keys fall back to the defaults. */
	decode(this: void, raw: unknown): NotificationEvents {
		const o = D.object(raw, 'NotificationEvents');
		return {
			imageUpdate: D.optBoolean(o, 'image_update') ?? true,
			containerUpdate: D.optBoolean(o, 'container_update') ?? true,
			vulnerabilityFound: D.optBoolean(o, 'vulnerability_found') ?? true,
			pruneReport: D.optBoolean(o, 'prune_report') ?? false,
			autoHeal: D.optBoolean(o, 'auto_heal') ?? false
		};
	},

	encode(this: void, value: NotificationEvents): Record<string, unknown> {
		return {
			image_update: value.imageUpdate,
			container_update: value.containerUpdate,
			vulnerability_found: value.vulnerabilityFound,
			prune_report: value.pruneReport,
			auto_heal: value.autoHeal
		};
	}
} as const;

// MARK: - Email enums

export type EmailTLSMode = 'none' | 'starttls' | 'ssl';

const emailTLSModeCases = ['none', 'starttls', 'ssl'] as const satisfies readonly EmailTLSMode[];

export const EmailTLSMode = {
	none: 'none',
	starttls: 'starttls',
	ssl: 'ssl',
	allCases: emailTLSModeCases,
	decode: strictEnumDecoder<EmailTLSMode>(emailTLSModeCases, 'EmailTLSMode')
} as const;

export type EmailAuthMode = 'none' | 'auto' | 'plain' | 'login' | 'crammd5';

const emailAuthModeCases = [
	'none',
	'auto',
	'plain',
	'login',
	'crammd5'
] as const satisfies readonly EmailAuthMode[];

export const EmailAuthMode = {
	none: 'none',
	auto: 'auto',
	plain: 'plain',
	login: 'login',
	crammd5: 'crammd5',
	allCases: emailAuthModeCases,
	decode: strictEnumDecoder<EmailAuthMode>(emailAuthModeCases, 'EmailAuthMode')
} as const;

// MARK: - NotificationConfiguration

export type NotificationConfiguration =
	| { kind: 'discord'; value: DiscordNotificationConfiguration }
	| { kind: 'email'; value: EmailNotificationConfiguration }
	| { kind: 'telegram'; value: TelegramNotificationConfiguration }
	| { kind: 'signal'; value: SignalNotificationConfiguration }
	| { kind: 'slack'; value: SlackNotificationConfiguration }
	| { kind: 'ntfy'; value: NtfyNotificationConfiguration }
	| { kind: 'pushover'; value: PushoverNotificationConfiguration }
	| { kind: 'gotify'; value: GotifyNotificationConfiguration }
	| { kind: 'matrix'; value: MatrixNotificationConfiguration }
	| { kind: 'googlechat'; value: GoogleChatNotificationConfiguration }
	| { kind: 'generic'; value: GenericNotificationConfiguration };

/**
 * Port of the private `sanitizedNotificationSecret`: drops blank, `redacted`,
 * and masked (`***` / `•••`) secrets so an update never writes the server's
 * redaction placeholder back as the real secret.
 */
function sanitizedNotificationSecret(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	if (
		trimmed === '' ||
		trimmed.toLowerCase() === 'redacted' ||
		Array.from(trimmed).every((c) => c === '*' || c === '•')
	) {
		return undefined;
	}
	return value;
}

export const NotificationConfiguration = {
	discord: (value: DiscordNotificationConfiguration): NotificationConfiguration => ({
		kind: 'discord',
		value
	}),
	email: (value: EmailNotificationConfiguration): NotificationConfiguration => ({
		kind: 'email',
		value
	}),
	telegram: (value: TelegramNotificationConfiguration): NotificationConfiguration => ({
		kind: 'telegram',
		value
	}),
	signal: (value: SignalNotificationConfiguration): NotificationConfiguration => ({
		kind: 'signal',
		value
	}),
	slack: (value: SlackNotificationConfiguration): NotificationConfiguration => ({
		kind: 'slack',
		value
	}),
	ntfy: (value: NtfyNotificationConfiguration): NotificationConfiguration => ({
		kind: 'ntfy',
		value
	}),
	pushover: (value: PushoverNotificationConfiguration): NotificationConfiguration => ({
		kind: 'pushover',
		value
	}),
	gotify: (value: GotifyNotificationConfiguration): NotificationConfiguration => ({
		kind: 'gotify',
		value
	}),
	matrix: (value: MatrixNotificationConfiguration): NotificationConfiguration => ({
		kind: 'matrix',
		value
	}),
	googlechat: (value: GoogleChatNotificationConfiguration): NotificationConfiguration => ({
		kind: 'googlechat',
		value
	}),
	generic: (value: GenericNotificationConfiguration): NotificationConfiguration => ({
		kind: 'generic',
		value
	}),

	provider(config: NotificationConfiguration): NotificationProvider {
		return config.kind;
	},

	/** Swift `NotificationProvider.decodeConfiguration`: decodes `raw` as the provider's configuration. */
	decode(provider: NotificationProvider, raw: unknown): NotificationConfiguration {
		switch (provider) {
			case 'discord':
				return { kind: 'discord', value: DiscordNotificationConfiguration.decode(raw) };
			case 'email':
				return { kind: 'email', value: EmailNotificationConfiguration.decode(raw) };
			case 'telegram':
				return { kind: 'telegram', value: TelegramNotificationConfiguration.decode(raw) };
			case 'signal':
				return { kind: 'signal', value: SignalNotificationConfiguration.decode(raw) };
			case 'slack':
				return { kind: 'slack', value: SlackNotificationConfiguration.decode(raw) };
			case 'ntfy':
				return { kind: 'ntfy', value: NtfyNotificationConfiguration.decode(raw) };
			case 'pushover':
				return { kind: 'pushover', value: PushoverNotificationConfiguration.decode(raw) };
			case 'gotify':
				return { kind: 'gotify', value: GotifyNotificationConfiguration.decode(raw) };
			case 'matrix':
				return { kind: 'matrix', value: MatrixNotificationConfiguration.decode(raw) };
			case 'googlechat':
				return { kind: 'googlechat', value: GoogleChatNotificationConfiguration.decode(raw) };
			case 'generic':
				return { kind: 'generic', value: GenericNotificationConfiguration.decode(raw) };
		}
	},

	/** Swift `encodedValue`: the provider configuration's JSON object. */
	encode(config: NotificationConfiguration): Record<string, unknown> {
		switch (config.kind) {
			case 'discord':
				return DiscordNotificationConfiguration.encode(config.value);
			case 'email':
				return EmailNotificationConfiguration.encode(config.value);
			case 'telegram':
				return TelegramNotificationConfiguration.encode(config.value);
			case 'signal':
				return SignalNotificationConfiguration.encode(config.value);
			case 'slack':
				return SlackNotificationConfiguration.encode(config.value);
			case 'ntfy':
				return NtfyNotificationConfiguration.encode(config.value);
			case 'pushover':
				return PushoverNotificationConfiguration.encode(config.value);
			case 'gotify':
				return GotifyNotificationConfiguration.encode(config.value);
			case 'matrix':
				return MatrixNotificationConfiguration.encode(config.value);
			case 'googlechat':
				return GoogleChatNotificationConfiguration.encode(config.value);
			case 'generic':
				return GenericNotificationConfiguration.encode(config.value);
		}
	},

	/** @internal Swift `sanitizedForUpdate`: strips redacted placeholder secrets. */
	sanitizedForUpdate(config: NotificationConfiguration): NotificationConfiguration {
		switch (config.kind) {
			case 'discord':
				return {
					kind: 'discord',
					value: { ...config.value, token: sanitizedNotificationSecret(config.value.token) }
				};
			case 'email':
				return {
					kind: 'email',
					value: {
						...config.value,
						smtpPassword: sanitizedNotificationSecret(config.value.smtpPassword)
					}
				};
			case 'telegram':
				return {
					kind: 'telegram',
					value: { ...config.value, botToken: sanitizedNotificationSecret(config.value.botToken) }
				};
			case 'signal':
				return {
					kind: 'signal',
					value: {
						...config.value,
						password: sanitizedNotificationSecret(config.value.password),
						token: sanitizedNotificationSecret(config.value.token)
					}
				};
			case 'slack':
				return {
					kind: 'slack',
					value: { ...config.value, token: sanitizedNotificationSecret(config.value.token) }
				};
			case 'ntfy':
				return {
					kind: 'ntfy',
					value: { ...config.value, password: sanitizedNotificationSecret(config.value.password) }
				};
			case 'pushover':
				return {
					kind: 'pushover',
					value: { ...config.value, token: sanitizedNotificationSecret(config.value.token) }
				};
			case 'gotify':
				return {
					kind: 'gotify',
					value: { ...config.value, token: sanitizedNotificationSecret(config.value.token) }
				};
			case 'matrix':
				return {
					kind: 'matrix',
					value: { ...config.value, password: sanitizedNotificationSecret(config.value.password) }
				};
			case 'googlechat':
				return {
					kind: 'googlechat',
					value: {
						...config.value,
						webhookUrl: sanitizedNotificationSecret(config.value.webhookUrl)
					}
				};
			case 'generic':
				return config;
		}
	}
} as const;

// MARK: - Settings

export interface NotificationSettings {
	id: number;
	enabled: boolean;
	config: NotificationConfiguration;
}

export const NotificationSettings = {
	provider(this: void, settings: NotificationSettings): NotificationProvider {
		return NotificationConfiguration.provider(settings.config);
	},

	/** Swift `init(from:)`: `config` is decoded according to the `provider` key. */
	decode(this: void, raw: unknown): NotificationSettings {
		const o = D.object(raw, 'NotificationSettings');
		const id = D.int(o, 'id');
		if (id < 0) throw new DecodingError('Expected unsigned integer', 'id');
		const enabled = D.boolean(o, 'enabled');
		const provider = D.nested(o, 'provider', NotificationProvider.decode);
		return {
			id,
			enabled,
			config: D.nested(o, 'config', (value) => NotificationConfiguration.decode(provider, value))
		};
	},

	encode(this: void, settings: NotificationSettings): Record<string, unknown> {
		return {
			id: settings.id,
			provider: NotificationSettings.provider(settings),
			enabled: settings.enabled,
			config: NotificationConfiguration.encode(settings.config)
		};
	}
} as const;

export interface UpdateNotificationSettings {
	enabled: boolean;
	config: NotificationConfiguration;
}

export const UpdateNotificationSettings = {
	provider(settings: UpdateNotificationSettings): NotificationProvider {
		return NotificationConfiguration.provider(settings.config);
	},

	decode(raw: unknown): UpdateNotificationSettings {
		const o = D.object(raw, 'UpdateNotificationSettings');
		const enabled = D.boolean(o, 'enabled');
		const provider = D.nested(o, 'provider', NotificationProvider.decode);
		return {
			enabled,
			config: D.nested(o, 'config', (value) => NotificationConfiguration.decode(provider, value))
		};
	},

	/** Swift `encode(to:)`: redacted placeholder secrets are stripped from `config`. */
	encode(settings: UpdateNotificationSettings): Record<string, unknown> {
		return {
			provider: UpdateNotificationSettings.provider(settings),
			enabled: settings.enabled,
			config: NotificationConfiguration.encode(
				NotificationConfiguration.sanitizedForUpdate(settings.config)
			)
		};
	}
} as const;

export interface NotificationTestResponse {
	message: string;
	warning?: string;
}

export interface AppriseSettings {
	id: number;
	apiUrl: string;
	enabled: boolean;
	imageUpdateTag: string;
	containerUpdateTag: string;
}

export interface UpdateAppriseSettings {
	apiUrl: string;
	enabled: boolean;
	imageUpdateTag: string;
	containerUpdateTag: string;
}

// MARK: - Test / dispatch

export type NotificationTestType =
	| 'simple'
	| 'image-update'
	| 'batch-image-update'
	| 'vulnerability-found'
	| 'prune-report'
	| 'auto-heal';

export const NotificationTestType = {
	simple: 'simple',
	imageUpdate: 'image-update',
	batchImageUpdate: 'batch-image-update',
	vulnerabilityFound: 'vulnerability-found',
	pruneReport: 'prune-report',
	autoHeal: 'auto-heal',
	allCases: [
		'simple',
		'image-update',
		'batch-image-update',
		'vulnerability-found',
		'prune-report',
		'auto-heal'
	] as const satisfies readonly NotificationTestType[]
} as const;

export type NotificationDispatchKind =
	| 'image_update'
	| 'batch_image_update'
	| 'container_update'
	| 'vulnerability_found'
	| 'prune_report'
	| 'auto_heal';

export const NotificationDispatchKind = {
	imageUpdate: 'image_update',
	batchImageUpdate: 'batch_image_update',
	containerUpdate: 'container_update',
	vulnerabilityFound: 'vulnerability_found',
	pruneReport: 'prune_report',
	autoHeal: 'auto_heal'
} as const satisfies Record<string, NotificationDispatchKind>;

export interface NotificationDispatchImageUpdate {
	imageRef: string;
	updateInfo: JSONValue;
}

export interface NotificationDispatchBatchImageUpdate {
	updates: Record<string, JSONValue>;
}

export interface NotificationDispatchContainerUpdate {
	containerName: string;
	imageRef: string;
	oldDigest?: string;
	newDigest?: string;
}

export interface NotificationDispatchVulnerabilityFound {
	cveId: string;
	cveLink: string;
	severity: string;
	imageName: string;
	fixedVersion?: string;
	pkgName?: string;
	installedVersion?: string;
}

export interface NotificationDispatchPruneReport {
	result: JSONValue;
}

export interface NotificationDispatchAutoHeal {
	containerName: string;
	containerId: string;
}

export interface NotificationDispatchRequest {
	kind: NotificationDispatchKind;
	imageUpdate?: NotificationDispatchImageUpdate;
	batchImageUpdate?: NotificationDispatchBatchImageUpdate;
	containerUpdate?: NotificationDispatchContainerUpdate;
	vulnerabilityFound?: NotificationDispatchVulnerabilityFound;
	pruneReport?: NotificationDispatchPruneReport;
	autoHeal?: NotificationDispatchAutoHeal;
}
