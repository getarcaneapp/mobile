import { formatArcaneDate, parseArcaneDate } from '@/sdk/models/base/date';
import type {
	CreateFederatedCredential,
	FederatedCredential,
	UpdateFederatedCredential
} from '@/sdk/models/federated/FederatedCredential';

export interface FederatedCredentialForm {
	name: string;
	description: string;
	enabled: boolean;
	issuerUrl: string;
	audiences: string;
	subjectClaim: string;
	subjectMatch: string;
	matchType: string;
	roleId: string;
	environmentId: string;
	tokenTtlSeconds: string;
	expires: boolean;
	expiresAt: Date;
}

const characterCount = (value: string) => Array.from(value).length;

function tokenTtl(form: FederatedCredentialForm): number {
	const trimmed = form.tokenTtlSeconds.trim();
	return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

function isHTTPSURL(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.hostname !== '';
	} catch {
		return false;
	}
}

export const FederatedCredentialForm = {
	make(credential?: FederatedCredential): FederatedCredentialForm {
		const defaultExpiry = new Date(Date.now() + 86400 * 30 * 1000);
		if (!credential) {
			return {
				name: '',
				description: '',
				enabled: true,
				issuerUrl: '',
				audiences: '',
				subjectClaim: 'sub',
				subjectMatch: '',
				matchType: 'exact',
				roleId: '',
				environmentId: '',
				tokenTtlSeconds: '300',
				expires: false,
				expiresAt: defaultExpiry
			};
		}
		const expiresAt = parseArcaneDate(credential.expiresAt);
		return {
			name: credential.name,
			description: credential.description ?? '',
			enabled: credential.enabled,
			issuerUrl: credential.issuerUrl,
			audiences: credential.audiences.join('\n'),
			subjectClaim: credential.subjectClaim,
			subjectMatch: credential.subjectMatch,
			matchType: credential.matchType,
			roleId: credential.roleId,
			environmentId: credential.environmentId ?? '',
			tokenTtlSeconds: String(credential.tokenTtlSeconds),
			expires: credential.expiresAt !== undefined,
			expiresAt: expiresAt ?? defaultExpiry
		};
	},

	audienceValues(form: FederatedCredentialForm): string[] {
		return form.audiences.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '');
	},

	validationMessage(form: FederatedCredentialForm): string | undefined {
		if (form.name.trim() === '' || characterCount(form.name) > 255)
			return 'Enter a name of up to 255 characters.';
		if (!isHTTPSURL(form.issuerUrl)) return 'Enter an HTTPS issuer URL.';
		if (
			FederatedCredentialForm.audienceValues(form).length === 0 ||
			form.subjectClaim === '' ||
			form.subjectMatch === '' ||
			form.roleId === ''
		) {
			return 'Enter audiences and a subject rule, and choose a role.';
		}
		const ttl = tokenTtl(form);
		if (!(ttl >= 60 && ttl <= 3600)) return 'Token lifetime must be 60–3600 seconds.';
		if (characterCount(form.description) > 1000)
			return 'Description must be at most 1000 characters.';
		if (form.expires && form.expiresAt.getTime() <= Date.now())
			return 'Choose a future expiration date.';
		return undefined;
	},

	createRequest(form: FederatedCredentialForm): CreateFederatedCredential {
		return {
			name: form.name,
			description: form.description,
			enabled: form.enabled,
			issuerUrl: form.issuerUrl,
			audiences: FederatedCredentialForm.audienceValues(form),
			subjectClaim: form.subjectClaim,
			subjectMatch: form.subjectMatch,
			matchType: form.matchType,
			roleId: form.roleId,
			environmentId: form.environmentId === '' ? undefined : form.environmentId,
			tokenTtlSeconds: tokenTtl(form),
			expiresAt: form.expires ? formatArcaneDate(form.expiresAt) : undefined
		};
	},

	updateRequest(form: FederatedCredentialForm): UpdateFederatedCredential {
		return {
			name: form.name,
			description: form.description,
			enabled: form.enabled,
			issuerUrl: form.issuerUrl,
			audiences: FederatedCredentialForm.audienceValues(form),
			subjectClaim: form.subjectClaim,
			subjectMatch: form.subjectMatch,
			matchType: form.matchType,
			roleId: form.roleId,
			environmentId: form.environmentId,
			tokenTtlSeconds: tokenTtl(form),
			expiresAt: form.expires ? formatArcaneDate(form.expiresAt) : undefined
		};
	}
} as const;

export type FederatedCredentialDetailPayload = {
	credential: FederatedCredential;
	onSaved: () => Promise<void>;
};
export type FederatedCredentialFormPayload = {
	credential?: FederatedCredential;
	onSaved: () => Promise<void>;
};
