import { useRouter } from 'expo-router';
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { resourceNameRegex, VolumeRename, volumesChanged } from './volume-model';

export type DriverMode = 'local' | 'custom';

export function useCreateVolume(environmentID: EnvironmentID) {
	const router = useRouter();
	const [name, setName] = useState('');
	const [driverMode, setDriverMode] = useState<DriverMode>('local');
	const [customDriver, setCustomDriver] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const driver = driverMode === 'local' ? 'local' : customDriver.trim();
	const canCreate = name !== '' && !isLoading && (driverMode === 'local' || driver !== '');

	const createVolume = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		try {
			const path = client.rest.environmentPath(environmentID, 'volumes');
			await client.transport.rawRequest(path, { method: 'POST', body: { name, driver } });
			volumesChanged(environmentID);
			showToast(Toasts.success('Volume created'));
			router.back();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	};

	return {
		name,
		setName,
		driverMode,
		setDriverMode,
		customDriver,
		setCustomDriver,
		errorMessage,
		canCreate,
		driverHelper:
			driverMode === 'local'
				? 'Use local unless your Docker host has a volume driver plugin.'
				: 'Enter the exact Docker volume driver plugin name.',
		create: () => void createVolume(),
		cancel: () => router.back()
	};
}

export function useRenameVolume(
	environmentID: EnvironmentID,
	currentName: string,
	popsDetail: boolean
) {
	const router = useRouter();
	const [newName, setNewName] = useState(currentName);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const isValid = resourceNameRegex.test(newName);
	const hasChanged = newName !== currentName;

	const submit = async () => {
		setIsSubmitting(true);
		setErrorMessage(undefined);
		try {
			await VolumeRename.perform(currentName, newName, environmentID);
			setIsSubmitting(false);
			if (popsDetail) router.dismiss(2);
			else router.back();
		} catch (error) {
			setIsSubmitting(false);
			setErrorMessage(friendlyErrorMessage(error));
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
