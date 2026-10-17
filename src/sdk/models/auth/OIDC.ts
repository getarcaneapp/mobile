/** Port of Models/Auth/OIDC.swift. */
import type { ISODateString } from '../base/date';
import { D } from '../base/decoding';
import { User } from '../user/User';

export interface OIDCStatusInfo {
	envForced: boolean;
	envConfigured: boolean;
	mergeAccounts: boolean;
	providerName?: string;
	providerLogoUrl?: string;
}

export interface OIDCAuthURLRequest {
	redirectUri: string;
	mobileRedirectUri?: string;
}

export interface OIDCAuthURLResponse {
	authUrl: string;
}

export interface OIDCConfigResponse {
	clientId: string;
	redirectUri: string;
	issuerUrl: string;
	authorizationEndpoint: string;
	tokenEndpoint: string;
	userinfoEndpoint: string;
	deviceAuthorizationEndpoint?: string;
	scopes: string;
}

export interface OIDCCallbackRequest {
	code: string;
	state: string;
	mobileRedirectUri?: string;
}

export interface OIDCCallbackResponse {
	success: boolean;
	token: string;
	refreshToken: string;
	expiresAt: ISODateString;
	user: User;
}

export interface OIDCDeviceAuthRequest {
	redirectUri?: string;
}

export interface OIDCDeviceAuthResponse {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete?: string;
	expiresIn: number;
	interval?: number;
}

export interface OIDCDeviceTokenRequest {
	deviceCode: string;
}

export interface OIDCDeviceTokenResponse {
	success: boolean;
	token: string;
	refreshToken: string;
	expiresAt: ISODateString;
	user: User;
}

export const OIDCDeviceTokenResponse = {
	decode(this: void, raw: unknown): OIDCDeviceTokenResponse {
		const o = D.object(raw, 'OIDCDeviceTokenResponse');
		return {
			success: D.boolean(o, 'success'),
			token: D.string(o, 'token'),
			refreshToken: D.string(o, 'refreshToken'),
			expiresAt: D.string(o, 'expiresAt'),
			user: D.nested(o, 'user', User.decode)
		};
	}
} as const;

export const OIDCCallbackResponse = {
	decode: OIDCDeviceTokenResponse.decode as (raw: unknown) => OIDCCallbackResponse
} as const;
