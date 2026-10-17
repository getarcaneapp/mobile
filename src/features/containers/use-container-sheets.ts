import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { showToast, Toasts } from '@/ui/toast';

import { containersChanged } from './container-actions';

const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/;

function useDismissOnContextChange(environmentID: EnvironmentID, onDismiss: () => void) {
	const generation = useClientManager((s) => s.clientGeneration);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const initial = useRef({ generation, activeEnvironmentID });
	const dismiss = useRef(onDismiss);
	dismiss.current = onDismiss;
	useEffect(() => {
		if (generation !== initial.current.generation) dismiss.current();
		else if (
			activeEnvironmentID !== initial.current.activeEnvironmentID &&
			activeEnvironmentID !== environmentID
		)
			dismiss.current();
	}, [generation, activeEnvironmentID, environmentID]);
}

export function useRenameContainer(
	environmentID: EnvironmentID,
	containerID: string,
	currentName: string
) {
	const router = useRouter();
	const [newName, setNewName] = useState(currentName);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const isValid = nameRegex.test(newName);
	const hasChanged = newName !== currentName;

	const submit = async () => {
		const client = useClientManager.getState().client;
		setIsSubmitting(true);
		setErrorMessage(undefined);
		try {
			if (!client) throw new Error('No client');
			await client.containers.rename({ envID: environmentID, id: containerID, newName });
			containersChanged(environmentID);
			showToast(Toasts.success('Container renamed'));
			router.back();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		newName,
		setNewName,
		isSubmitting,
		errorMessage,
		canSave: isValid && hasChanged && !isSubmitting,
		submit: () => void submit(),
		cancel: () => router.back()
	};
}

export function useContainerCommit(environmentID: EnvironmentID, containerID: string) {
	const router = useRouter();
	const [repository, setRepository] = useState('');
	const [tag, setTag] = useState('latest');
	const [comment, setComment] = useState('');
	const [author, setAuthor] = useState('');
	const [changes, setChanges] = useState('');
	const [pause, setPause] = useState(true);
	const [busy, setBusy] = useState(false);
	const controller = useRef<AbortController | undefined>(undefined);
	useClientManager((s) => s.accessGeneration);
	const canCommit = hasPermission('images:commit', environmentID);

	const dismiss = () => {
		controller.current?.abort();
		router.back();
	};
	useDismissOnContextChange(environmentID, dismiss);
	useEffect(() => () => controller.current?.abort(), []);

	const commit = async () => {
		const client = useClientManager.getState().client;
		if (!client || !hasPermission('images:commit', environmentID)) return;
		const generation = useClientManager.getState().clientGeneration;
		const abort = new AbortController();
		controller.current = abort;
		setBusy(true);
		try {
			await client.withSignal(abort.signal).containers.commit({
				envID: environmentID,
				id: containerID,
				body: {
					repository,
					tag,
					comment,
					author,
					changes: changes.split(/\r\n|[\n\r]/).filter((line) => line !== ''),
					noPause: !pause
				}
			});
			if (abort.signal.aborted || generation !== useClientManager.getState().clientGeneration)
				return;
			useResourceMutationStore.getState().markChanged('images', environmentID);
			showToast(Toasts.success('Image created'));
			router.back();
		} catch (error) {
			if (!isCancellation(error) && !abort.signal.aborted)
				showToast(Toasts.error(error instanceof Error ? error.message : String(error)));
		} finally {
			setBusy(false);
		}
	};

	return {
		fields: { repository, tag, comment, author, changes, pause },
		set: { setRepository, setTag, setComment, setAuthor, setChanges, setPause },
		busy,
		canSubmit: !busy && repository.trim() !== '' && canCommit,
		commit: () => void commit(),
		cancel: dismiss
	};
}

export function useContainerCompose(environmentID: EnvironmentID, containerIDs: string[]) {
	const router = useRouter();
	const [content, setContent] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>();
	const generation = useClientManager((s) => s.clientGeneration);
	useDismissOnContextChange(environmentID, () => router.back());
	const ids = containerIDs.join(',');

	useEffect(() => {
		const client = useClientManager.getState().client;
		if (!client) {
			setLoading(false);
			setError('Connect to a server to continue.');
			return;
		}
		const abort = new AbortController();
		void client
			.withSignal(abort.signal)
			.containers.generateCompose({
				envID: environmentID,
				body: { containerIds: ids.split(',').filter((id) => id !== '') }
			})
			.then((response) => {
				setContent(response.composeContent);
				setLoading(false);
			})
			.catch((e: unknown) => {
				if (abort.signal.aborted || isCancellation(e)) return;
				setLoading(false);
				setError(e instanceof Error ? e.message : String(e));
			});
		return () => abort.abort();
	}, [environmentID, ids, generation]);

	return { content, setContent, loading, error, done: () => router.back() };
}
