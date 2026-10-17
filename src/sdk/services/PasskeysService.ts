/** Port of Services/PasskeysService.swift. */
import type { AuthManager } from '../auth/AuthManager';
import { ArcaneError } from '../errors/ArcaneError';
import { ArcaneRequestOptions } from '../http/requestOptions';
import type { RESTService } from '../http/RESTService';
import { AuthenticationResult, MFAChallenge } from '../models/auth/Login';
import type {
	MFAFinishRequest,
	MFAStartRequest,
	MFAStatus,
	MobilePasskeyExchangeRequest,
	PasskeyCapabilities,
	PasskeyChallenge,
	PasskeyCredential,
	PasskeyFinishRequest,
	PasskeySummary,
	PasswordStepUpRequest,
	RecoveryCodeRequest,
	RecoveryCodesResponse,
	RenamePasskeyRequest,
	StepUpGrant
} from '../models/auth/Passkey';

export class PasskeysService {
	private readonly rest: RESTService;
	private readonly authManager: AuthManager;

	/** @internal */
	constructor(rest: RESTService, authManager: AuthManager) {
		this.rest = rest;
		this.authManager = authManager;
	}

	beginLogin(): Promise<PasskeyChallenge> {
		return this.rest.transport.request<PasskeyChallenge>('auth/passkey/login/begin', {
			method: 'POST',
			authorized: false
		});
	}

	finishLogin(args: {
		ceremonyId: string;
		credential: PasskeyCredential;
	}): Promise<AuthenticationResult> {
		const body: PasskeyFinishRequest = { ceremonyId: args.ceremonyId, credential: args.credential };
		return this.authenticate('auth/passkey/login/finish', body);
	}

	exchangeMobileLogin(args: {
		transactionId: string;
		codeVerifier: string;
	}): Promise<AuthenticationResult> {
		const body: MobilePasskeyExchangeRequest = {
			transactionId: args.transactionId,
			codeVerifier: args.codeVerifier
		};
		return this.authenticate('auth/passkey/mobile/exchange', body);
	}

	beginMFA(args: { transactionId: string }): Promise<MFAChallenge> {
		const body: MFAStartRequest = { transactionId: args.transactionId };
		return this.rest.transport.request('auth/mfa/passkey/begin', {
			method: 'POST',
			body,
			authorized: false,
			decode: MFAChallenge.decode
		});
	}

	finishMFA(args: {
		transactionId: string;
		credential: PasskeyCredential;
	}): Promise<AuthenticationResult> {
		const body: MFAFinishRequest = {
			transactionId: args.transactionId,
			credential: args.credential
		};
		return this.authenticate('auth/mfa/passkey/finish', body);
	}

	finishRecovery(args: { transactionId: string; code: string }): Promise<AuthenticationResult> {
		const body: RecoveryCodeRequest = { transactionId: args.transactionId, code: args.code };
		return this.authenticate('auth/mfa/recovery', body);
	}

	list(): Promise<PasskeySummary[]> {
		return this.rest.get('auth/me/passkeys');
	}

	capabilities(): Promise<PasskeyCapabilities> {
		return this.rest.get('auth/me/passkeys/capabilities');
	}

	beginRegistration(args: { stepUpToken?: string } = {}): Promise<PasskeyChallenge> {
		return this.rest.post('auth/me/passkeys/register/begin', {
			options: requestOptions(args.stepUpToken)
		});
	}

	finishRegistration(args: {
		ceremonyId: string;
		credential: PasskeyCredential;
		name?: string;
		stepUpToken?: string;
	}): Promise<PasskeySummary> {
		const body: PasskeyFinishRequest = {
			ceremonyId: args.ceremonyId,
			credential: args.credential,
			name: args.name?.trim()
		};
		return this.rest.post('auth/me/passkeys/register/finish', {
			body,
			options: requestOptions(args.stepUpToken)
		});
	}

	async rename(args: { id: string; name: string; stepUpToken: string }): Promise<PasskeySummary> {
		const body: RenamePasskeyRequest = { name: args.name };
		return this.rest.put(`auth/me/passkeys/${encodedPathSegment(args.id)}`, {
			body,
			options: requestOptions(args.stepUpToken)
		});
	}

	async delete(args: { id: string; stepUpToken: string }): Promise<void> {
		return this.rest.deleteVoid(`auth/me/passkeys/${encodedPathSegment(args.id)}`, {
			options: requestOptions(args.stepUpToken)
		});
	}

	beginStepUp(): Promise<PasskeyChallenge> {
		return this.rest.post('auth/me/passkeys/reauth/begin');
	}

	finishStepUp(args: {
		transactionId: string;
		credential: PasskeyCredential;
	}): Promise<StepUpGrant> {
		const body: MFAFinishRequest = {
			transactionId: args.transactionId,
			credential: args.credential
		};
		return this.rest.post('auth/me/passkeys/reauth/finish', { body });
	}

	passwordStepUp(args: { password: string }): Promise<StepUpGrant> {
		const body: PasswordStepUpRequest = { password: args.password };
		return this.rest.post('auth/me/passkeys/reauth/password', { body });
	}

	mfaStatus(): Promise<MFAStatus> {
		return this.rest.get('auth/me/mfa');
	}

	enableMFA(args: { stepUpToken: string }): Promise<RecoveryCodesResponse> {
		return this.rest.post('auth/me/mfa/enable', { options: requestOptions(args.stepUpToken) });
	}

	disableMFA(args: { stepUpToken: string }): Promise<void> {
		return this.rest.postVoid('auth/me/mfa/disable', { options: requestOptions(args.stepUpToken) });
	}

	regenerateRecoveryCodes(args: { stepUpToken: string }): Promise<RecoveryCodesResponse> {
		return this.rest.post('auth/me/mfa/recovery-codes/regenerate', {
			options: requestOptions(args.stepUpToken)
		});
	}

	/** Unauthenticated POST that yields an `AuthenticationResult` and persists it. */
	private async authenticate(path: string, body: unknown): Promise<AuthenticationResult> {
		const generation = await this.authManager.beginAuthenticationOperation();
		const result = await this.rest.transport.request(path, {
			method: 'POST',
			body,
			authorized: false,
			decode: AuthenticationResult.decode
		});
		await this.authManager.saveAuthenticationResult(result, generation);
		return result;
	}
}

function requestOptions(stepUpToken: string | undefined): ArcaneRequestOptions | undefined {
	if (stepUpToken === undefined || stepUpToken === '') return undefined;
	return ArcaneRequestOptions.withStepUpToken(stepUpToken);
}

/** `CharacterSet.urlPathAllowed` minus `/?#`. Throws a validation error for an empty ID. */
function encodedPathSegment(value: string): string {
	if (value === '') {
		throw ArcaneError.validation({ id: ['Passkey identifier is required.'] });
	}
	return encodeURIComponent(value).replace(/%(24|26|2B|2C|3B|3D|3A|40)/gi, (match) =>
		decodeURIComponent(match)
	);
}
