/**
 * Port of NotificationProviderModels.swift (provider presentation,
 * `EventSubscriptions`, `NotificationProviderFormState`) plus
 * `notificationProviders(supportsPost26Features:)` (NotificationSettingsView.swift),
 * `NotificationTestType.displayName` (NotificationProviderFormView.swift) and
 * `StableStringRow` / `StableHeaderRow` (Types/StableFormRows.swift). Pure TS.
 */
import { systemColors } from '@/theme/colors';
import {
	EmailAuthMode,
	EmailTLSMode,
	NotificationConfiguration,
	NotificationEvents,
	NotificationProvider,
	type NotificationSettings,
	type NotificationTestType
} from '@/sdk/models/notification/Notification';

// MARK: - NotificationProvider presentation

export const providerDisplayName: Record<NotificationProvider, string> = {
	discord: 'Discord',
	email: 'Email',
	telegram: 'Telegram',
	signal: 'Signal',
	slack: 'Slack',
	ntfy: 'Ntfy',
	pushover: 'Pushover',
	gotify: 'Gotify',
	matrix: 'Matrix',
	googlechat: 'Google Chat',
	generic: 'Generic'
};

export const providerSystemImage: Record<NotificationProvider, string> = {
	discord: 'bubble.left.fill',
	email: 'envelope.fill',
	telegram: 'paperplane.fill',
	signal: 'lock.fill',
	slack: 'number',
	ntfy: 'bell.fill',
	pushover: 'iphone.radiowaves.left.and.right',
	gotify: 'arrow.up.message.fill',
	matrix: 'square.grid.3x3.fill',
	googlechat: 'message.fill',
	generic: 'link'
};

export const providerIconColor: Record<NotificationProvider, string> = {
	discord: systemColors.indigo,
	email: systemColors.blue,
	telegram: systemColors.cyan,
	signal: systemColors.blue,
	slack: systemColors.purple,
	ntfy: systemColors.green,
	pushover: systemColors.teal,
	gotify: systemColors.orange,
	matrix: systemColors.green,
	googlechat: systemColors.blue,
	generic: systemColors.gray
};

/** `notificationProviders(supportsPost26Features:)`: Google Chat needs a post-2.6 server. */
export function notificationProviders(supportsPost26Features: boolean): NotificationProvider[] {
	return NotificationProvider.allCases.filter(
		(provider) => provider !== 'googlechat' || supportsPost26Features
	);
}

export const testTypeDisplayName: Record<NotificationTestType, string> = {
	simple: 'Simple',
	'image-update': 'Image Update',
	'batch-image-update': 'Batch Image Update',
	'vulnerability-found': 'Vulnerability Found',
	'prune-report': 'Prune Report',
	'auto-heal': 'Auto-Heal'
};

// MARK: - Stable rows

let nextRowID = 0;
const makeRowID = () => `row-${nextRowID++}`;

export type StableStringRow = { id: string; value: string };
export type StableHeaderRow = { id: string; name: string; value: string };

export const StableStringRow = {
	make: (value = ''): StableStringRow => ({ id: makeRowID(), value })
};

export const StableHeaderRow = {
	make: (name = '', value = ''): StableHeaderRow => ({
		id: makeRowID(),
		name,
		value
	})
};

// MARK: - EventSubscriptions

export type EventSubscriptions = NotificationEvents;

// MARK: - Form state

export type NotificationProviderFormState = {
	enabled: boolean;
	events: EventSubscriptions;

	webhookID: string;
	webhookURL: string;
	token: string;
	username: string;
	password: string;
	title: string;
	host: string;
	port: string;
	path: string;
	priority: string;
	disableTLS: boolean;
	disableTLSVerification: boolean;

	avatarURL: string;

	smtpUsername: string;
	fromAddress: string;
	tlsMode: string;
	authMode: string;
	recipients: StableStringRow[];

	preview: boolean;
	notification: boolean;
	parseMode: string;

	user: string;
	source: string;

	botName: string;
	icon: string;
	color: string;
	channel: string;
	threadTS: string;

	topic: string;
	tags: StableStringRow[];
	cache: boolean;
	firebase: boolean;

	devices: StableStringRow[];

	insecureSkipVerify: boolean;
	useHeader: boolean;

	rooms: string;

	method: string;
	contentType: string;
	titleKey: string;
	messageKey: string;
	headers: StableHeaderRow[];
	successBodyContains: string;
	payloadTemplate: string;
};

const blankState = (): NotificationProviderFormState => ({
	enabled: false,
	events: NotificationEvents.make(),
	webhookID: '',
	webhookURL: '',
	token: '',
	username: '',
	password: '',
	title: '',
	host: '',
	port: '',
	path: '',
	priority: '0',
	disableTLS: false,
	disableTLSVerification: false,
	avatarURL: '',
	smtpUsername: '',
	fromAddress: '',
	tlsMode: EmailTLSMode.starttls,
	authMode: EmailAuthMode.auto,
	recipients: [],
	preview: true,
	notification: true,
	parseMode: '',
	user: '',
	source: '',
	botName: '',
	icon: '',
	color: '',
	channel: '',
	threadTS: '',
	topic: '',
	tags: [],
	cache: true,
	firebase: true,
	devices: [],
	insecureSkipVerify: false,
	useHeader: false,
	rooms: '',
	method: 'POST',
	contentType: 'application/json',
	titleKey: 'title',
	messageKey: 'message',
	headers: [],
	successBodyContains: '',
	payloadTemplate: ''
});

const eventsOf = (events: NotificationEvents | undefined): EventSubscriptions => ({
	...(events ?? NotificationEvents.defaults)
});
const rowsOf = (values: string[] | undefined) =>
	(values ?? []).map((value) => StableStringRow.make(value));

/** Swift `String.nilIfEmpty`: trimmed, or undefined when blank. */
function nilIfEmpty(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

/** Swift `Array.nilIfEmpty`. */
const listOrNil = (values: string[]) => (values.length === 0 ? undefined : values);

/** `[StableStringRow].values`: trimmed, non-blank values. */
export function rowValues(rows: StableStringRow[]): string[] {
	return rows.map((row) => row.value.trim()).filter((value) => value !== '');
}

/** `[StableHeaderRow].dictionary`: rows with a non-blank (trimmed) name. */
function headerDictionary(rows: StableHeaderRow[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const row of rows) {
		const name = row.name.trim();
		if (name === '') continue;
		result[name] = row.value;
	}
	return result;
}

/** Swift `Int(_:)`: optional sign and digits only. */
function swiftInt(raw: string): number | undefined {
	return /^[+-]?\d+$/.test(raw) ? Number(raw) : undefined;
}

const localizedStandardCompare = (lhs: string, rhs: string) =>
	lhs.localeCompare(rhs, undefined, { numeric: true, sensitivity: 'base' });

export const NotificationProviderFormState = {
	/** `init(provider:existing:)`. */
	make(
		provider: NotificationProvider,
		existing: NotificationSettings | undefined
	): NotificationProviderFormState {
		const state = blankState();
		switch (provider) {
			case 'email':
				state.port = '587';
				break;
			case 'signal':
				state.port = '8080';
				break;
			case 'ntfy':
				state.host = 'ntfy.sh';
				state.port = '0';
				state.priority = 'default';
				break;
			case 'pushover':
			case 'gotify':
				state.priority = '0';
				break;
			default:
				break;
		}
		if (!existing) return state;
		state.enabled = existing.enabled;

		const config = existing.config;
		switch (config.kind) {
			case 'discord': {
				const c = config.value;
				state.webhookID = c.webhookId;
				state.token = c.token ?? '';
				state.username = c.username ?? '';
				state.avatarURL = c.avatarUrl ?? '';
				state.events = eventsOf(c.events);
				break;
			}
			case 'email': {
				const c = config.value;
				state.host = c.smtpHost;
				state.port = String(c.smtpPort);
				state.smtpUsername = c.smtpUsername;
				state.password = c.smtpPassword ?? '';
				state.fromAddress = c.fromAddress;
				state.recipients = rowsOf(c.toAddresses);
				state.tlsMode = c.tlsMode;
				state.authMode = c.authMode ?? EmailAuthMode.auto;
				state.events = eventsOf(c.events);
				break;
			}
			case 'telegram': {
				const c = config.value;
				state.token = c.botToken ?? '';
				state.recipients = rowsOf(c.chatIds);
				state.preview = c.preview;
				state.notification = c.notification;
				state.parseMode = c.parseMode ?? '';
				state.title = c.title ?? '';
				state.events = eventsOf(c.events);
				break;
			}
			case 'signal': {
				const c = config.value;
				state.host = c.host;
				state.port = String(c.port);
				state.user = c.user ?? '';
				state.password = c.password ?? '';
				state.token = c.token ?? '';
				state.source = c.source;
				state.recipients = rowsOf(c.recipients);
				state.disableTLS = c.disableTls;
				state.events = eventsOf(c.events);
				break;
			}
			case 'slack': {
				const c = config.value;
				state.token = c.token ?? '';
				state.botName = c.botName ?? '';
				state.icon = c.icon ?? '';
				state.color = c.color ?? '';
				state.title = c.title ?? '';
				state.channel = c.channel ?? '';
				state.threadTS = c.threadTs ?? '';
				state.events = eventsOf(c.events);
				break;
			}
			case 'ntfy': {
				const c = config.value;
				state.host = c.host;
				state.port = String(c.port);
				state.topic = c.topic;
				state.username = c.username ?? '';
				state.password = c.password ?? '';
				state.title = c.title ?? '';
				state.priority = c.priority ?? 'default';
				state.tags = rowsOf(c.tags);
				state.icon = c.icon ?? '';
				state.cache = c.cache;
				state.firebase = c.firebase;
				state.disableTLS = c.disableTls;
				state.disableTLSVerification = c.disableTlsVerification;
				state.events = eventsOf(c.events);
				break;
			}
			case 'pushover': {
				const c = config.value;
				state.token = c.token ?? '';
				state.user = c.user;
				state.devices = rowsOf(c.devices);
				state.priority = String(c.priority);
				state.title = c.title ?? '';
				state.events = eventsOf(c.events);
				break;
			}
			case 'gotify': {
				const c = config.value;
				state.host = c.host;
				state.port = c.port === undefined ? '' : String(c.port);
				state.token = c.token ?? '';
				state.path = c.path ?? '';
				state.priority = c.priority === undefined ? '0' : String(c.priority);
				state.title = c.title ?? '';
				state.disableTLS = c.disableTls;
				state.insecureSkipVerify = c.insecureSkipVerify;
				state.useHeader = c.useHeader;
				state.events = eventsOf(c.events);
				break;
			}
			case 'matrix': {
				const c = config.value;
				state.host = c.host;
				state.port = c.port === undefined ? '' : String(c.port);
				state.rooms = c.rooms;
				state.username = c.username ?? '';
				state.password = c.password ?? '';
				state.disableTLSVerification = c.disableTlsVerification;
				state.events = eventsOf(c.events);
				break;
			}
			case 'googlechat': {
				const c = config.value;
				state.webhookURL = c.webhookUrl ?? '';
				state.events = eventsOf(c.events);
				break;
			}
			case 'generic': {
				const c = config.value;
				state.webhookURL = c.webhookUrl;
				state.method = c.method ?? 'POST';
				state.contentType = c.contentType ?? 'application/json';
				state.titleKey = c.titleKey ?? 'title';
				state.messageKey = c.messageKey ?? 'message';
				state.headers = Object.entries(c.customHeaders ?? {})
					.sort(([lhs], [rhs]) => localizedStandardCompare(lhs, rhs))
					.map(([name, value]) => StableHeaderRow.make(name, value));
				state.disableTLS = c.disableTls;
				state.successBodyContains = c.successBodyContains ?? '';
				state.payloadTemplate = c.payloadTemplate ?? '';
				state.events = eventsOf(c.events);
				break;
			}
		}
		return state;
	},

	/** `configuration(for:supportsPost26Features:)`. */
	configuration(
		state: NotificationProviderFormState,
		provider: NotificationProvider,
		supportsPost26Features = true
	): NotificationConfiguration {
		const events = { ...state.events };
		switch (provider) {
			case 'discord':
				return NotificationConfiguration.discord({
					webhookId: state.webhookID,
					token: nilIfEmpty(state.token),
					username: nilIfEmpty(state.username),
					avatarUrl: nilIfEmpty(state.avatarURL),
					events
				});
			case 'email':
				return NotificationConfiguration.email({
					smtpHost: state.host,
					smtpPort: swiftInt(state.port) ?? 0,
					smtpUsername: state.smtpUsername,
					smtpPassword: nilIfEmpty(state.password),
					fromAddress: state.fromAddress,
					toAddresses: rowValues(state.recipients),
					tlsMode: (EmailTLSMode.allCases as readonly string[]).includes(state.tlsMode)
						? (state.tlsMode as EmailTLSMode)
						: 'starttls',
					authMode: (EmailAuthMode.allCases as readonly string[]).includes(state.authMode)
						? (state.authMode as EmailAuthMode)
						: 'auto',
					events
				});
			case 'telegram':
				return NotificationConfiguration.telegram({
					botToken: nilIfEmpty(state.token),
					chatIds: rowValues(state.recipients),
					preview: state.preview,
					notification: state.notification,
					parseMode: nilIfEmpty(state.parseMode),
					title: nilIfEmpty(state.title),
					events
				});
			case 'signal':
				return NotificationConfiguration.signal({
					host: state.host,
					port: swiftInt(state.port) ?? 0,
					user: nilIfEmpty(state.user),
					password: nilIfEmpty(state.password),
					token: nilIfEmpty(state.token),
					source: state.source,
					recipients: rowValues(state.recipients),
					disableTls: state.disableTLS,
					events
				});
			case 'slack':
				return NotificationConfiguration.slack({
					token: nilIfEmpty(state.token),
					botName: nilIfEmpty(state.botName),
					icon: nilIfEmpty(state.icon),
					color: nilIfEmpty(state.color),
					title: nilIfEmpty(state.title),
					channel: nilIfEmpty(state.channel),
					threadTs: nilIfEmpty(state.threadTS),
					events
				});
			case 'ntfy':
				return NotificationConfiguration.ntfy({
					host: state.host,
					port: swiftInt(state.port) ?? 0,
					topic: state.topic,
					username: nilIfEmpty(state.username),
					password: nilIfEmpty(state.password),
					title: nilIfEmpty(state.title),
					priority: nilIfEmpty(state.priority),
					tags: listOrNil(rowValues(state.tags)),
					icon: nilIfEmpty(state.icon),
					cache: state.cache,
					firebase: state.firebase,
					disableTls: state.disableTLS,
					disableTlsVerification: state.disableTLSVerification,
					events
				});
			case 'pushover':
				return NotificationConfiguration.pushover({
					token: nilIfEmpty(state.token),
					user: state.user,
					devices: listOrNil(rowValues(state.devices)),
					priority: swiftInt(state.priority) ?? 0,
					title: nilIfEmpty(state.title),
					events
				});
			case 'gotify':
				return NotificationConfiguration.gotify({
					host: state.host,
					port: swiftInt(state.port),
					token: nilIfEmpty(state.token),
					path: nilIfEmpty(state.path),
					priority: swiftInt(state.priority),
					title: nilIfEmpty(state.title),
					disableTls: state.disableTLS,
					insecureSkipVerify: state.insecureSkipVerify,
					useHeader: state.useHeader,
					events
				});
			case 'matrix':
				return NotificationConfiguration.matrix({
					host: state.host,
					port: swiftInt(state.port),
					rooms: state.rooms,
					username: nilIfEmpty(state.username),
					password: nilIfEmpty(state.password),
					disableTlsVerification: state.disableTLSVerification,
					events
				});
			case 'googlechat':
				return NotificationConfiguration.googlechat({
					webhookUrl: nilIfEmpty(state.webhookURL),
					events
				});
			case 'generic': {
				const headers = headerDictionary(state.headers);
				return NotificationConfiguration.generic({
					webhookUrl: state.webhookURL,
					method: nilIfEmpty(state.method),
					contentType: supportsPost26Features ? nilIfEmpty(state.contentType) : undefined,
					titleKey: supportsPost26Features ? nilIfEmpty(state.titleKey) : undefined,
					messageKey: supportsPost26Features ? nilIfEmpty(state.messageKey) : undefined,
					customHeaders: Object.keys(headers).length === 0 ? undefined : headers,
					disableTls: state.disableTLS,
					events,
					successBodyContains: supportsPost26Features
						? nilIfEmpty(state.successBodyContains)
						: undefined,
					payloadTemplate: supportsPost26Features ? nilIfEmpty(state.payloadTemplate) : undefined
				});
			}
		}
	},

	/** `isValid(for:)`. */
	isValid(state: NotificationProviderFormState, provider: NotificationProvider): boolean {
		const hasPort = swiftInt(state.port) !== undefined;
		switch (provider) {
			case 'discord':
				return state.webhookID !== '';
			case 'email':
				return (
					state.host !== '' &&
					hasPort &&
					state.fromAddress !== '' &&
					rowValues(state.recipients).length > 0
				);
			case 'telegram':
				return rowValues(state.recipients).length > 0;
			case 'signal':
				return (
					state.host !== '' &&
					hasPort &&
					state.source !== '' &&
					rowValues(state.recipients).length > 0
				);
			case 'slack':
				return state.token !== '';
			case 'ntfy':
				return state.host !== '' && hasPort && state.topic !== '';
			case 'pushover':
				return state.user !== '';
			case 'gotify':
				return state.host !== '';
			case 'matrix':
				return state.host !== '' && state.rooms !== '';
			case 'googlechat':
			case 'generic':
				return state.webhookURL !== '';
		}
	},

	/** Swift synthesized `Equatable`. */
	equals(lhs: NotificationProviderFormState, rhs: NotificationProviderFormState): boolean {
		return JSON.stringify(lhs) === JSON.stringify(rhs);
	}
} as const;
