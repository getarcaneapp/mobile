import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { useClientManager } from '@/stores/client-manager';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import {
	EnvironmentUpdateStage,
	UpgradeProgressEvent,
	type UpgradeCheckResult
} from '@/sdk/models/system/Upgrade';
import { User } from '@/sdk/models/user/User';

export interface SystemUpgradeProgress {
	fraction: number;
	detail?: string;
	finished: boolean;
}

export type SystemUpgradePhase =
	| { kind: 'checking' }
	| { kind: 'ready'; result: UpgradeCheckResult }
	| { kind: 'checkFailed'; message: string }
	| { kind: 'triggering' }
	| { kind: 'triggered'; message: string; progress?: SystemUpgradeProgress }
	| { kind: 'triggerFailed'; message: string };

type ProgressOutcome =
	| { kind: 'completed'; version?: string }
	| { kind: 'failed'; message: string };

const progressRetryDelayMs = 2000;
const progressMaxAttempts = 90;

const wait = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true }
		);
	});

function progressDetail(event: UpgradeProgressEvent, previous: string | undefined) {
	if (event.type === 'stage' && event.message) return EnvironmentUpdateStage.label(event.message);
	if (event.type === 'log' && event.message) return event.message.trim();
	return previous;
}

async function readUpgradeProgress(
	client: ArcaneClient,
	environmentID: EnvironmentID,
	signal: AbortSignal,
	onProgress: (progress: SystemUpgradeProgress) => void
): Promise<ProgressOutcome | undefined> {
	let detail: string | undefined;
	let fraction = 0;
	for (let attempt = 0; attempt < progressMaxAttempts && !signal.aborted; attempt++) {
		try {
			for await (const event of client
				.withSignal(signal)
				.system.upgradeProgress({ envID: environmentID })) {
				fraction = Math.max(fraction, Math.min(1, event.percent / 100));
				detail = progressDetail(event, detail);
				if (UpgradeProgressEvent.isDone(event)) {
					if (event.message && event.percent < 100)
						return { kind: 'failed', message: event.message };
					return { kind: 'completed', version: event.toVersion };
				}
				onProgress({ fraction, detail, finished: false });
			}
		} catch (error) {
			if (isCancellation(error) || signal.aborted) return undefined;
		}
		await wait(progressRetryDelayMs, signal);
	}
	return undefined;
}

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
	const supportsProgress = useClientManager((s) => s.apiGeneration === 'v3');
	const [phase, setPhase] = useState<SystemUpgradePhase>({ kind: 'checking' });
	const progressTask = useRef<AbortController | undefined>(undefined);

	useEffect(() => () => progressTask.current?.abort(), []);

	const followProgress = async (activeClient: ArcaneClient, message: string) => {
		progressTask.current?.abort();
		const controller = new AbortController();
		progressTask.current = controller;
		const outcome = await readUpgradeProgress(
			activeClient,
			environmentID,
			controller.signal,
			(progress) => {
				if (!controller.signal.aborted) setPhase({ kind: 'triggered', message, progress });
			}
		);
		if (controller.signal.aborted || outcome === undefined) return;
		if (outcome.kind === 'failed') {
			setPhase({ kind: 'triggerFailed', message: outcome.message });
			return;
		}
		setPhase({
			kind: 'triggered',
			message: outcome.version
				? `Arcane restarted on ${outcome.version}.`
				: 'Arcane restarted on the new version.',
			progress: { fraction: 1, finished: true }
		});
	};

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
		} catch (error) {
			setPhase({ kind: 'triggerFailed', message: friendlyErrorMessage(error) });
			return;
		}
		const message = 'Upgrade initiated. Arcane will restart shortly.';
		if (!supportsProgress) {
			setPhase({ kind: 'triggered', message });
			return;
		}
		setPhase({ kind: 'triggered', message, progress: { fraction: 0, finished: false } });
		await followProgress(client, message);
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
