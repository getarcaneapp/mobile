import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { useClientManager } from '@/stores/client-manager';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { UpgradeCheckResult } from '@/sdk/models/system/Upgrade';
import { User } from '@/sdk/models/user/User';

export type SystemUpgradePhase =
	| { kind: 'checking' }
	| { kind: 'ready'; result: UpgradeCheckResult }
	| { kind: 'checkFailed'; message: string }
	| { kind: 'triggering' }
	| { kind: 'triggered'; message: string }
	| { kind: 'triggerFailed'; message: string };

export const systemUpgradeConfirmationHost = 'system-upgrade';

export function useSystemUpgradeRoute() {
	const params = useLocalSearchParams<{ envID?: string; name?: string }>();
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const name = params.name !== undefined && params.name !== '' ? params.name : undefined;
	return {
		environmentID: params.envID ?? activeEnvironmentID,
		environmentName: name,
		isSheet: params.name === undefined
	};
}

export function useSystemUpgrade(
	environmentID: EnvironmentID,
	environmentName: string | undefined
) {
	const client = useClientManager((s) => s.client);
	const currentUser = useClientManager((s) => s.currentUser);
	const isAdmin = currentUser ? User.isAdmin(currentUser) : false;
	const [phase, setPhase] = useState<SystemUpgradePhase>({ kind: 'checking' });

	const checkUpgrade = useCallback(async () => {
		if (!client) {
			setPhase({ kind: 'checkFailed', message: 'Not connected' });
			return;
		}
		setPhase({ kind: 'checking' });
		try {
			const result = await client.system.checkUpgrade({ envID: environmentID });
			setPhase({ kind: 'ready', result });
		} catch (error) {
			setPhase({ kind: 'checkFailed', message: friendlyErrorMessage(error) });
		}
	}, [client, environmentID]);

	const triggerUpgrade = async () => {
		if (!client) {
			setPhase({ kind: 'triggerFailed', message: 'Not connected' });
			return;
		}
		setPhase({ kind: 'triggering' });
		try {
			await client.system.triggerUpgrade({ envID: environmentID });
			setPhase({ kind: 'triggered', message: 'Upgrade initiated. Arcane will restart shortly.' });
		} catch (error) {
			setPhase({ kind: 'triggerFailed', message: friendlyErrorMessage(error) });
		}
	};

	useEffect(() => {
		if (!isAdmin) return;
		void checkUpgrade();
	}, [isAdmin]);

	const confirmationMessage = environmentName
		? `Arcane on ${environmentName} will restart. The mobile app may briefly lose connection.`
		: 'Arcane will restart. The mobile app may briefly lose connection.';

	return {
		isAdmin,
		phase,
		checkUpgrade: () => void checkUpgrade(),
		triggerUpgrade: () => void triggerUpgrade(),
		confirmation: {
			title: 'Upgrade Arcane?',
			message: confirmationMessage,
			icon: 'arrow.up.circle',
			confirmTitle: 'Upgrade'
		}
	};
}

export type SystemUpgradeModel = ReturnType<typeof useSystemUpgrade>;

export const systemUpgradeCopy = {
	whatHappensNext:
		'A new Arcane container will be created from the latest image and replace this one. The mobile app will briefly lose connection while it restarts.',
	unsupported:
		'Arcane can only self-upgrade when running in a Docker container with access to the Docker socket. Update Arcane from your deployment instead.',
	reconnecting:
		"A new Arcane container is starting. The mobile app may briefly lose connection — pull to refresh once it's back."
};
