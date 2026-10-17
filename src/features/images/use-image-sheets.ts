import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import type { ImageSearchResult } from '@/sdk/models/image/ImageOperations';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { showToast, Toasts } from '@/ui/toast';

import { imagesChanged, startImagePull } from './image-actions';
import { imagePruneResultMessage, type ImagePruneMode } from './image-model';
import { pickedFileName } from '@/core/picked-file-name';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useDismissOnContextChange(onDismiss: () => void) {
	const generation = useClientManager((s) => s.clientGeneration);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const initial = useRef({ generation, activeEnvironmentID });
	const dismiss = useRef(onDismiss);
	dismiss.current = onDismiss;
	useEffect(() => {
		if (
			generation !== initial.current.generation ||
			activeEnvironmentID !== initial.current.activeEnvironmentID
		)
			dismiss.current();
	}, [generation, activeEnvironmentID]);
}

export function usePullImage(environmentID: EnvironmentID) {
	const router = useRouter();
	const [imageName, setImageName] = useState('');
	const [searchTerm, setSearchTerm] = useState('');
	const [searchResults, setSearchResults] = useState<ImageSearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState<string>();
	const serverURL = useClientManager((s) => s.serverURL);
	const generation = useClientManager((s) => s.clientGeneration);
	const dismiss = () => router.back();
	useDismissOnContextChange(dismiss);

	useEffect(() => {
		setSearchResults([]);
		setSearchError(undefined);
		const term = searchTerm.trim();
		const client = useClientManager.getState().client;
		if (term === '' || !client) return;
		let cancelled = false;
		setSearching(true);
		const timer = setTimeout(() => {
			void client.images
				.search({ envID: environmentID, term })
				.then((results) => {
					if (!cancelled) setSearchResults(results);
				})
				.catch((error: unknown) => {
					if (cancelled || isCancellation(error)) return;
					setSearchError(
						isArcaneError(error, 'notFound')
							? 'Image search is not available on this server.'
							: errorText(error)
					);
				})
				.finally(() => {
					if (!cancelled) setSearching(false);
				});
		}, 350);
		return () => {
			cancelled = true;
			clearTimeout(timer);
			setSearching(false);
		};
	}, [serverURL, generation, environmentID, searchTerm]);

	const startPull = () => {
		const reference = imageName.trim();
		const manager = useClientManager.getState();
		if (
			reference === '' ||
			!hasPermission('images:pull', environmentID) ||
			!manager.acceptsEnvironmentContext(environmentID)
		)
			return;
		dismiss();
		startImagePull(
			environmentID,
			reference,
			useEnvironmentsStore.getState().displayName(environmentID) ?? manager.activeEnvironmentName
		);
	};

	return {
		imageName,
		setImageName,
		searchTerm,
		setSearchTerm,
		searchResults,
		searching,
		searchError,
		canPull: imageName.trim() !== '',
		startPull,
		cancel: dismiss
	};
}

type PickedFile = { uri: string; name: string; size: number };

export function useUploadImage(environmentID: EnvironmentID) {
	const router = useRouter();
	const [picked, setPicked] = useState<PickedFile>();
	const [isUploading, setIsUploading] = useState(false);
	const [output, setOutput] = useState<string>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const controller = useRef<AbortController | undefined>(undefined);
	useEffect(() => () => controller.current?.abort(), []);

	const pickFile = async () => {
		try {
			const result = await File.pickFileAsync();
			if (result.canceled) return;
			const file = result.result;
			setPicked({ uri: file.uri, name: pickedFileName(file), size: file.size ?? 0 });
			setOutput(undefined);
			setErrorMessage(undefined);
		} catch (error) {
			if (!isCancellation(error)) setErrorMessage(friendlyErrorMessage(error));
		}
	};

	const startUpload = async () => {
		const client = useClientManager.getState().client;
		if (!client || !picked) {
			setErrorMessage('Invalid configuration');
			return;
		}
		setIsUploading(true);
		setErrorMessage(undefined);
		setOutput(undefined);
		const abort = new AbortController();
		controller.current = abort;
		try {
			const result = await client
				.withSignal(abort.signal)
				.images.upload({ envID: environmentID, fileURL: picked.uri, filename: picked.name });
			if (abort.signal.aborted) {
				setErrorMessage('Cancelled');
				return;
			}
			const serverOutput = result.stream.trim();
			setOutput(serverOutput === '' ? 'Upload complete.' : serverOutput);
			imagesChanged(environmentID);
			showToast(Toasts.success('Image uploaded'));
		} catch (error) {
			setErrorMessage(
				abort.signal.aborted || isCancellation(error) ? 'Cancelled' : friendlyErrorMessage(error)
			);
		} finally {
			setIsUploading(false);
			controller.current = undefined;
		}
	};

	return {
		picked,
		isUploading,
		output,
		errorMessage,
		pickFile: () => void pickFile(),
		upload: () => void startUpload(),
		stop: () => controller.current?.abort(),
		dismiss: () => router.back()
	};
}

export function useImagePrune(environmentID: EnvironmentID) {
	const router = useRouter();
	const [mode, setMode] = useState<ImagePruneMode>('dangling');
	const [until, setUntil] = useState('24h');
	const [isPruning, setIsPruning] = useState(false);

	const runPrune = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsPruning(true);
		try {
			const report = await client.images.prune({
				envID: environmentID,
				mode,
				until: mode === 'olderThan' ? until : undefined
			});
			imagesChanged(environmentID);
			showToast(Toasts.success(imagePruneResultMessage(report)));
			router.back();
		} catch (error) {
			Alert.alert('Prune failed', friendlyErrorMessage(error), [{ text: 'OK' }]);
		} finally {
			setIsPruning(false);
		}
	};

	return {
		mode,
		setMode,
		until,
		setUntil,
		isPruning,
		prune: () => void runPrune(),
		cancel: () => router.back()
	};
}

export function useImageTag(environmentID: EnvironmentID, imageID: string) {
	const router = useRouter();
	const [repository, setRepository] = useState('');
	const [tag, setTag] = useState('');
	const [saving, setSaving] = useState(false);
	const controller = useRef<AbortController | undefined>(undefined);
	const dismiss = () => {
		controller.current?.abort();
		router.back();
	};
	useDismissOnContextChange(dismiss);

	const save = async () => {
		const client = useClientManager.getState().client;
		if (!hasPermission('images:tag', environmentID) || !client) return;
		const generation = useClientManager.getState().clientGeneration;
		const abort = new AbortController();
		controller.current = abort;
		setSaving(true);
		try {
			await client.withSignal(abort.signal).images.tag({
				envID: environmentID,
				imageID,
				request: { repository: repository.trim(), tag: tag === '' ? undefined : tag.trim() }
			});
			if (abort.signal.aborted || generation !== useClientManager.getState().clientGeneration)
				return;
			imagesChanged(environmentID);
			showToast(Toasts.success('Image tagged'));
			router.back();
		} catch (error) {
			if (!abort.signal.aborted) showToast(Toasts.error(errorText(error)));
		} finally {
			setSaving(false);
		}
	};

	return {
		repository,
		setRepository,
		tag,
		setTag,
		saving,
		canSave: !saving && repository.trim() !== '',
		save: () => void save(),
		cancel: dismiss
	};
}
