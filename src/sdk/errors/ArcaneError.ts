import type { JSONValue } from '../types/json';

export type ArcaneErrorKind =
	| 'proxyAuthenticationRequired'
	| 'authenticationRejected'
	| 'unauthorized'
	| 'forbidden'
	| 'notFound'
	| 'conflict'
	| 'validation'
	| 'rateLimited'
	| 'server'
	| 'transport'
	| 'decoding'
	| 'unknown';

export abstract class ArcaneError extends Error {
	abstract readonly kind: ArcaneErrorKind;

	equals(other: unknown): boolean {
		if (!(other instanceof ArcaneError) || other.kind !== this.kind) return false;
		return JSON.stringify(this.payload()) === JSON.stringify(other.payload());
	}

	protected payload(): unknown {
		return null;
	}

	static proxyAuthenticationRequired(): ArcaneProxyAuthenticationRequiredError {
		return new ArcaneProxyAuthenticationRequiredError();
	}
	static authenticationRejected(): ArcaneAuthenticationRejectedError {
		return new ArcaneAuthenticationRejectedError();
	}
	static unauthorized(): ArcaneUnauthorizedError {
		return new ArcaneUnauthorizedError();
	}
	static forbidden(): ArcaneForbiddenError {
		return new ArcaneForbiddenError();
	}
	static notFound(): ArcaneNotFoundError {
		return new ArcaneNotFoundError();
	}
	static conflict(message?: string): ArcaneConflictError {
		return new ArcaneConflictError(message);
	}
	static validation(fields: Record<string, string[]>): ArcaneValidationError {
		return new ArcaneValidationError(fields);
	}
	static rateLimited(retryAfter?: number): ArcaneRateLimitedError {
		return new ArcaneRateLimitedError(retryAfter);
	}
	static server(code: string, message: string): ArcaneServerError {
		return new ArcaneServerError(code, message);
	}
	static transport(message: string): ArcaneTransportError {
		return new ArcaneTransportError(message);
	}
	static decoding(message: string): ArcaneDecodingError {
		return new ArcaneDecodingError(message);
	}
	static unknown(statusCode: number, body: string): ArcaneUnknownError {
		return new ArcaneUnknownError(statusCode, body);
	}
}

export class ArcaneProxyAuthenticationRequiredError extends ArcaneError {
	readonly kind = 'proxyAuthenticationRequired' as const;
	constructor() {
		super('Proxy authentication is required.');
		this.name = 'ArcaneError.proxyAuthenticationRequired';
	}
}

export class ArcaneAuthenticationRejectedError extends ArcaneError {
	readonly kind = 'authenticationRejected' as const;
	constructor() {
		super('Authentication was rejected by an intermediary.');
		this.name = 'ArcaneError.authenticationRejected';
	}
}

export class ArcaneUnauthorizedError extends ArcaneError {
	readonly kind = 'unauthorized' as const;
	constructor() {
		super('Unauthorized');
		this.name = 'ArcaneError.unauthorized';
	}
}

export class ArcaneForbiddenError extends ArcaneError {
	readonly kind = 'forbidden' as const;
	constructor() {
		super('Forbidden');
		this.name = 'ArcaneError.forbidden';
	}
}

export class ArcaneNotFoundError extends ArcaneError {
	readonly kind = 'notFound' as const;
	constructor() {
		super('Not found');
		this.name = 'ArcaneError.notFound';
	}
}

export class ArcaneConflictError extends ArcaneError {
	readonly kind = 'conflict' as const;
	readonly conflictMessage: string | undefined;
	constructor(message?: string) {
		super(message ?? 'Conflict');
		this.name = 'ArcaneError.conflict';
		this.conflictMessage = message;
	}
	protected override payload(): unknown {
		return this.conflictMessage ?? null;
	}
}

export class ArcaneValidationError extends ArcaneError {
	readonly kind = 'validation' as const;
	readonly fields: Record<string, string[]>;
	constructor(fields: Record<string, string[]>) {
		super(
			Object.entries(fields)
				.map(([key, messages]) => `${key}: ${messages.join(', ')}`)
				.join('; ') || 'Validation failed'
		);
		this.name = 'ArcaneError.validation';
		this.fields = fields;
	}
	protected override payload(): unknown {
		return Object.fromEntries(Object.entries(this.fields).sort(([a], [b]) => a.localeCompare(b)));
	}
}

export class ArcaneRateLimitedError extends ArcaneError {
	readonly kind = 'rateLimited' as const;
	readonly retryAfter: number | undefined;
	constructor(retryAfter?: number) {
		super('Rate limited');
		this.name = 'ArcaneError.rateLimited';
		this.retryAfter = retryAfter;
	}
	protected override payload(): unknown {
		return this.retryAfter ?? null;
	}
}

export class ArcaneServerError extends ArcaneError {
	readonly kind = 'server' as const;
	readonly code: string;
	readonly serverMessage: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = 'ArcaneError.server';
		this.code = code;
		this.serverMessage = message;
	}
	protected override payload(): unknown {
		return [this.code, this.serverMessage];
	}
}

export class ArcaneTransportError extends ArcaneError {
	readonly kind = 'transport' as const;
	constructor(message: string) {
		super(message);
		this.name = 'ArcaneError.transport';
	}
	protected override payload(): unknown {
		return this.message;
	}
}

export class ArcaneDecodingError extends ArcaneError {
	readonly kind = 'decoding' as const;
	constructor(message: string) {
		super(message);
		this.name = 'ArcaneError.decoding';
	}
	protected override payload(): unknown {
		return this.message;
	}
}

export class ArcaneUnknownError extends ArcaneError {
	readonly kind = 'unknown' as const;
	readonly statusCode: number;
	readonly body: string;
	constructor(statusCode: number, body: string) {
		super(`HTTP ${statusCode}: ${body.slice(0, 200)}`);
		this.name = 'ArcaneError.unknown';
		this.statusCode = statusCode;
		this.body = body;
	}
	protected override payload(): unknown {
		return [this.statusCode, this.body];
	}
}

type ArcaneErrorByKind = {
	proxyAuthenticationRequired: ArcaneProxyAuthenticationRequiredError;
	authenticationRejected: ArcaneAuthenticationRejectedError;
	unauthorized: ArcaneUnauthorizedError;
	forbidden: ArcaneForbiddenError;
	notFound: ArcaneNotFoundError;
	conflict: ArcaneConflictError;
	validation: ArcaneValidationError;
	rateLimited: ArcaneRateLimitedError;
	server: ArcaneServerError;
	transport: ArcaneTransportError;
	decoding: ArcaneDecodingError;
	unknown: ArcaneUnknownError;
};

export function isArcaneError(error: unknown): error is ArcaneError;
export function isArcaneError<K extends ArcaneErrorKind>(
	error: unknown,
	kind: K
): error is ArcaneErrorByKind[K];
export function isArcaneError(error: unknown, kind?: ArcaneErrorKind): boolean {
	return error instanceof ArcaneError && (kind === undefined || error.kind === kind);
}

export class CancellationError extends Error {
	constructor(message = 'The operation was cancelled.') {
		super(message);
		this.name = 'CancellationError';
	}
}

export function isCancellationError(error: unknown): error is CancellationError {
	return error instanceof CancellationError;
}

export function isAbortError(error: unknown): boolean {
	if (error instanceof CancellationError) return true;
	if (typeof error !== 'object' || error === null) return false;
	const name = (error as { name?: unknown }).name;
	return name === 'AbortError';
}

export class ArcaneTimeoutError extends Error {
	constructor(message = 'The request timed out.') {
		super(message);
		this.name = 'TimeoutError';
	}
}

export function normalizedTransportError(error: unknown): Error {
	if (error instanceof CancellationError) return new CancellationError();
	if (error instanceof ArcaneError) return error;
	if (isAbortError(error)) return new CancellationError();
	if (error instanceof ArcaneTimeoutError) return ArcaneError.transport(error.message);
	if (error instanceof TypeError) return ArcaneError.transport(error.message);
	if (error instanceof Error) return error;
	return ArcaneError.transport(String(error));
}

export interface APIErrorResponse {
	success?: boolean;
	error?: string;
	message?: string;
	code?: string;
	details?: JSONValue;
}

interface HumaErrorDetail {
	message?: string;
	location?: string;
	value?: JSONValue;
}

interface HumaErrorResponse {
	title?: string;
	status?: number;
	detail?: string;
	errors?: HumaErrorDetail[];
}

function parseJSONObject(body: string): Record<string, unknown> | undefined {
	try {
		const parsed: unknown = JSON.parse(body);
		if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {}
	return undefined;
}

function optionalString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function httpCode(statusCode: number): string {
	switch (statusCode) {
		case 400:
			return 'BAD_REQUEST';
		case 401:
			return 'UNAUTHORIZED';
		case 403:
			return 'FORBIDDEN';
		case 404:
			return 'NOT_FOUND';
		case 409:
			return 'CONFLICT';
		case 504:
			return 'TIMEOUT';
		default:
			return `HTTP_${statusCode}`;
	}
}

function validationFields(details: unknown): Record<string, string[]> {
	if (typeof details !== 'object' || details === null || Array.isArray(details)) return {};
	const fields: Record<string, string[]> = {};
	for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
		if (typeof value === 'string') {
			fields[key] = [value];
		} else if (Array.isArray(value)) {
			fields[key] = value.filter((item): item is string => typeof item === 'string');
		}
	}
	return fields;
}

function stripLocationPrefix(location: string): string {
	for (const prefix of ['body.', 'query.', 'path.', 'header.', 'cookie.']) {
		if (location.startsWith(prefix)) return location.slice(prefix.length);
	}
	return location;
}

function validationFieldsFromHuma(errors: HumaErrorDetail[]): Record<string, string[]> {
	const fields: Record<string, string[]> = {};
	for (const detail of errors) {
		const name = stripLocationPrefix(detail.location ?? 'request');
		const message = detail.message ?? 'Invalid value';
		(fields[name] ??= []).push(message);
	}
	return fields;
}

export function arcaneErrorFrom(
	statusCode: number,
	body: string,
	headers?: { get(name: string): string | null }
): ArcaneError {
	const json = parseJSONObject(body);
	const arcaneError: APIErrorResponse | undefined = json
		? {
				success: typeof json.success === 'boolean' ? json.success : undefined,
				error: optionalString(json.error),
				message: optionalString(json.message),
				code: optionalString(json.code),
				details: json.details as JSONValue | undefined
			}
		: undefined;
	const arcaneHasFields =
		arcaneError?.error !== undefined ||
		arcaneError?.message !== undefined ||
		arcaneError?.code !== undefined;
	const humaError: HumaErrorResponse | undefined =
		arcaneHasFields || !json
			? undefined
			: {
					title: optionalString(json.title),
					status: typeof json.status === 'number' ? json.status : undefined,
					detail: optionalString(json.detail),
					errors: Array.isArray(json.errors)
						? json.errors.map((item: unknown) => {
								const o = (typeof item === 'object' && item !== null ? item : {}) as Record<
									string,
									unknown
								>;
								return {
									message: optionalString(o.message),
									location: optionalString(o.location),
									value: o.value as JSONValue | undefined
								};
							})
						: undefined
				};
	const humaMessage = humaError?.detail ?? humaError?.title;
	const message = arcaneError?.error ?? arcaneError?.message ?? humaMessage ?? body;
	const code = arcaneError?.code ?? httpCode(statusCode);

	if (statusCode === 401) return ArcaneError.unauthorized();
	if (statusCode === 403) return ArcaneError.forbidden();
	if (statusCode === 404) return ArcaneError.notFound();
	if (statusCode === 409) return ArcaneError.conflict(message === '' ? undefined : message);
	if (statusCode === 400 && code === 'VALIDATION_ERROR') {
		return ArcaneError.validation(validationFields(arcaneError?.details));
	}
	if (statusCode === 422) {
		const humaErrors = humaError?.errors;
		if (humaErrors && humaErrors.length > 0) {
			return ArcaneError.validation(validationFieldsFromHuma(humaErrors));
		}
		return ArcaneError.server(code, humaMessage ?? message);
	}
	if (statusCode === 429) {
		const raw = headers?.get('Retry-After');
		const retryAfter = raw != null && raw.trim() !== '' ? Number(raw) : undefined;
		return ArcaneError.rateLimited(
			retryAfter !== undefined && Number.isFinite(retryAfter) ? retryAfter : undefined
		);
	}
	if (statusCode >= 500 && statusCode <= 599) return ArcaneError.server(code, message);

	if (arcaneError?.code !== undefined) return ArcaneError.server(arcaneError.code, message);
	if (humaMessage !== undefined && humaMessage !== '') return ArcaneError.server(code, humaMessage);
	return ArcaneError.unknown(statusCode, body);
}
