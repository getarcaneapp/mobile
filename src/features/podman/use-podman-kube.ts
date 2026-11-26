import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import {
	KubePlayReport,
	type KubeDownRequest,
	type KubePlayRequest
} from '@/sdk/models/podman/Kube';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { plural, podmanChanged, usePodmanCan } from './podman-common';

export type KubeOperation = 'play' | 'down' | 'generate';

async function generateYAML(environmentID: EnvironmentID, podName: string) {
	const client = useClientManager.getState().client;
	if (!client) return undefined;
	const response = await client.podman.kubeGenerate({
		request: { names: [podName], type: 'pod' },
		envID: environmentID
	});
	return response.yaml;
}

async function playKube(environmentID: EnvironmentID, request: KubePlayRequest) {
	const client = useClientManager.getState().client;
	if (!client) return undefined;
	const report = await client.podman.kubePlay({ request, envID: environmentID });
	podmanChanged(environmentID);
	const count = plural(report.pods.length, 'pod');
	showToast(
		KubePlayReport.hasErrors(report)
			? Toasts.error(`Played ${count} with errors`)
			: Toasts.success(`Played ${count}`)
	);
	return KubePlayReport.lines(report);
}

async function downKube(environmentID: EnvironmentID, request: KubeDownRequest) {
	const client = useClientManager.getState().client;
	if (!client) return undefined;
	const report = await client.podman.kubeDown({ request, envID: environmentID });
	podmanChanged(environmentID);
	showToast(Toasts.success(`Removed ${plural(report.removed.length, 'pod')}`));
	return report.removed.map((id) => `Removed pod ${id.slice(0, 12)}`);
}

export function usePodmanKube() {
	const { envID = '0', pod } = useLocalSearchParams<{ envID?: string; pod?: string }>();
	const environmentID = envID;
	const can = usePodmanCan(environmentID);
	const [yaml, setYAML] = useState('');
	const [start, setStart] = useState(true);
	const [replace, setReplace] = useState(false);
	const [force, setForce] = useState(false);
	const [running, setRunning] = useState<KubeOperation | undefined>(() =>
		pod ? 'generate' : undefined
	);
	const [resultLines, setResultLines] = useState<string[]>([]);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [pendingDown, setPendingDown] = useState<true>();
	const canPlay = can(Permission.Podman.kubeCreate);
	const canDown = can(Permission.Podman.kubeDelete);

	useEffect(() => {
		if (!pod) return;
		let cancelled = false;
		void generateYAML(environmentID, pod)
			.then((generated) => {
				if (!cancelled && generated !== undefined) setYAML(generated);
			})
			.catch((error: unknown) => {
				if (!cancelled) setErrorMessage(friendlyErrorMessage(error));
			})
			.finally(() => {
				if (!cancelled) setRunning(undefined);
			});
		return () => {
			cancelled = true;
		};
	}, [environmentID, pod]);

	const perform = async (operation: 'play' | 'down', body: () => Promise<string[] | undefined>) => {
		if (yaml.trim() === '') return;
		setRunning(operation);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const lines = await body();
					if (lines) setResultLines(lines);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setRunning(undefined)
		);
	};

	const play = () => perform('play', () => playKube(environmentID, { yaml, start, replace }));
	const down = () => perform('down', () => downKube(environmentID, { yaml, force }));

	useItemDeleteConfirmation(pendingDown, setPendingDown, () => ({
		title: 'Tear Down',
		message: force
			? 'Remove the pods, containers and volumes this YAML created?'
			: 'Remove the pods and containers this YAML created?',
		icon: 'stop.circle',
		actions: [{ title: 'Tear Down', action: () => void down() }],
		dismissOnConfirm: false
	}));

	const hasYAML = yaml.trim() !== '';

	return {
		environmentID,
		generatedFrom: pod,
		yaml,
		setYAML,
		start,
		setStart,
		replace,
		setReplace,
		force,
		setForce,
		running,
		isBusy: running !== undefined,
		resultLines,
		errorMessage,
		canPlay,
		canDown,
		canSubmitPlay: canPlay && hasYAML && running === undefined,
		canSubmitDown: canDown && hasYAML && running === undefined,
		play: () => void play(),
		requestDown: () => setPendingDown(true)
	};
}

export type PodmanKubeModel = ReturnType<typeof usePodmanKube>;
