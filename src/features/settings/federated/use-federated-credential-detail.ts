import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { formatDate } from '@/core/date-formatting';
import { friendlyErrorMessage } from '@/core/errors';
import { parseArcaneDate } from '@/sdk/models/base/date';
import type { FederatedCredential } from '@/sdk/models/federated/FederatedCredential';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { settingsPayloads, useSettingsNavigation } from '../shared/settings-routes';
import type {
	FederatedCredentialDetailPayload,
	FederatedCredentialFormPayload
} from './federated-credential-form';
import { useCanManageFederated } from './use-federated-credentials';

const formatted = (value: string) => {
	const date = parseArcaneDate(value);
	return date ? formatDate(date, 'numeric', 'shortened') : value;
};

export type DetailRowValue = { label: string; value: string };

export function trustRuleRows(credential: FederatedCredential): DetailRowValue[] {
	return [
		{ label: 'Issuer', value: credential.issuerUrl },
		{ label: 'Audiences', value: credential.audiences.join(', ') },
		{ label: 'Subject claim', value: credential.subjectClaim },
		{ label: 'Match', value: credential.subjectMatch },
		{ label: 'Match type', value: credential.matchType },
		{ label: 'Status', value: credential.enabled ? 'Enabled' : 'Disabled' }
	];
}

export function accessRows(credential: FederatedCredential): DetailRowValue[] {
	const rows: DetailRowValue[] = [
		{ label: 'Role', value: credential.roleName ?? credential.roleId },
		{
			label: 'Environment',
			value: credential.environmentName ?? credential.environmentId ?? 'Global'
		},
		{ label: 'Service user', value: credential.serviceUsername ?? credential.identityUserId },
		{ label: 'Token lifetime', value: `${credential.tokenTtlSeconds} seconds` }
	];
	if (credential.lastUsedAt)
		rows.push({ label: 'Last used', value: formatted(credential.lastUsedAt) });
	if (credential.expiresAt) rows.push({ label: 'Expires', value: formatted(credential.expiresAt) });
	return rows;
}

export function useFederatedCredentialDetail() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const payload = settingsPayloads.get<FederatedCredentialDetailPayload>(token);
	const navigation = useSettingsNavigation();
	const stack = useNavigation();
	const canEdit = useCanManageFederated();
	const [credential, setCredential] = useState<FederatedCredential | undefined>(
		payload?.credential
	);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const initialGeneration = useRef(clientGeneration);

	useEffect(() => {
		if (clientGeneration !== initialGeneration.current && stack.canGoBack()) stack.goBack();
	}, [clientGeneration, stack]);

	const edit = () => {
		if (!credential) return;
		const form: FederatedCredentialFormPayload = {
			credential,
			onSaved: async () => {
				const client = useClientManager.getState().client;
				if (client) {
					try {
						setCredential(await client.federatedCredentials.get({ id: credential.id }));
					} catch (error) {
						showToast(Toasts.error(friendlyErrorMessage(error)));
					}
				}
				await payload?.onSaved();
			}
		};
		navigation.push('settings/federated/form', { token: settingsPayloads.put(form) });
	};

	return { credential, canEdit, edit };
}
