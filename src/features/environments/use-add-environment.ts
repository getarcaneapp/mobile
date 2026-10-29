import * as Clipboard from 'expo-clipboard';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { DeploymentSnippet } from '@/sdk/models/environment/Deployment';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { showToast, Toasts } from '@/ui/toast';

export type DeploymentFormat = 'compose' | 'run';

export const deploymentFormats: readonly { value: DeploymentFormat; title: string }[] = [
	{ value: 'compose', title: 'Compose' },
	{ value: 'run', title: 'Docker Run' }
];

const connectionPollMs = 3000;

export type AddEnvironmentPhase =
	| { kind: 'form' }
	| {
			kind: 'created';
			environment: Environment;
			snippet?: DeploymentSnippet;
			snippetError?: string;
			connected: boolean;
	  };

function isConnected(environment: Environment): boolean {
	return environment.connected === true || environment.status === 'online';
}

function useDismiss() {
	const navigation = useNavigation();
	return useCallback(() => {
		if (navigation.canGoBack()) navigation.goBack();
	}, [navigation]);
}

function environmentsChanged() {
	useResourceMutationStore.getState().markChanged('environments');
	void useEnvironmentsStore.getState().load({ refresh: true, loadsEnvironmentDetails: false });
}

export function useAddEnvironment() {
	const dismiss = useDismiss();
	const [name, setName] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [format, setFormat] = useState<DeploymentFormat>('compose');
	const [phase, setPhase] = useState<AddEnvironmentPhase>({ kind: 'form' });

	const create = async () => {
		const client = useClientManager.getState().client;
		const trimmed = name.trim();
		if (!client || trimmed === '') return;
		setIsCreating(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const result = await client.environments.createAgent({ name: trimmed });
					environmentsChanged();
					showToast(Toasts.success('Environment created'));
					setPhase({
						kind: 'created',
						environment: result.environment,
						connected: isConnected(result.environment)
					});
					try {
						const snippet = await client.environments.deploymentSnippets({
							id: result.environment.id
						});
						setPhase((current) => (current.kind === 'created' ? { ...current, snippet } : current));
					} catch (error) {
						const snippetError = friendlyErrorMessage(error);
						setPhase((current) =>
							current.kind === 'created' ? { ...current, snippetError } : current
						);
					}
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsCreating(false)
		);
	};

	const environmentID = phase.kind === 'created' ? phase.environment.id : undefined;
	const waitsForAgent = phase.kind === 'created' && !phase.connected;

	const refreshConnection = useEffectEvent(async (id: string) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const environment = await client.environments.get({ id }).catch(() => undefined);
		if (!environment || !isConnected(environment)) return;
		setPhase((current) =>
			current.kind === 'created' && current.environment.id === id
				? { ...current, environment, connected: true }
				: current
		);
		environmentsChanged();
		showToast(Toasts.success('Agent connected'));
	});

	useEffect(() => {
		if (!waitsForAgent || environmentID === undefined) return;
		const timer = setInterval(() => void refreshConnection(environmentID), connectionPollMs);
		return () => clearInterval(timer);
	}, [waitsForAgent, environmentID]);

	const snippetText =
		phase.kind === 'created' && phase.snippet
			? format === 'compose'
				? phase.snippet.dockerCompose
				: phase.snippet.dockerRun
			: undefined;

	return {
		phase,
		title: phase.kind === 'created' ? phase.environment.name || 'Environment' : 'Add Environment',
		name,
		setName,
		errorMessage,
		canCreate: name.trim() !== '' && !isCreating,
		isCreating,
		format,
		setFormat,
		snippetText,
		copySnippet: () => {
			if (snippetText === undefined) return;
			void Clipboard.setStringAsync(snippetText);
			showToast(
				Toasts.copied(format === 'compose' ? 'Compose file copied' : 'Docker run command copied')
			);
		},
		create: () => void create(),
		cancel: dismiss,
		done: dismiss
	};
}

export type AddEnvironmentModel = ReturnType<typeof useAddEnvironment>;
