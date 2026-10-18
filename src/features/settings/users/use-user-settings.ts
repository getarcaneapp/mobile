import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { EnvironmentID } from '@/sdk/client/environment';
import type { PublicSetting } from '@/sdk/models/settings/Settings';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

function isEnabledValue(value: string | undefined): boolean {
	return value?.toLowerCase() === 'true';
}

export function useUserSettings() {
	const [enableGravatar, setEnableGravatar] = useState(false);
	const [originalEnableGravatar, setOriginalEnableGravatar] = useState(false);
	const [avatarMaxUploadSizeMb, setAvatarMaxUploadSizeMb] = useState('2');
	const [originalAvatarMaxUploadSizeMb, setOriginalAvatarMaxUploadSizeMb] = useState('2');
	const [supportsAvatarUploadLimit, setSupportsAvatarUploadLimit] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const mounted = useRef(true);
	useEffect(
		() => () => {
			mounted.current = false;
		},
		[]
	);

	const hasChanges =
		enableGravatar !== originalEnableGravatar ||
		(supportsAvatarUploadLimit && avatarMaxUploadSizeMb !== originalAvatarMaxUploadSizeMb);

	const loadSettings = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const settings = await client.settings.getSettings({ envID: EnvironmentID.localDocker });
					const values = new Map(settings.map((setting) => [setting.key, setting.value]));
					if (!mounted.current) return;

					const gravatarEnabled = isEnabledValue(values.get('enableGravatar'));
					setEnableGravatar(gravatarEnabled);
					setOriginalEnableGravatar(gravatarEnabled);

					const uploadLimit = values.get('avatarMaxUploadSizeMb');
					if (uploadLimit !== undefined) {
						setAvatarMaxUploadSizeMb(uploadLimit);
						setOriginalAvatarMaxUploadSizeMb(uploadLimit);
						setSupportsAvatarUploadLimit(true);
					} else {
						setAvatarMaxUploadSizeMb('2');
						setOriginalAvatarMaxUploadSizeMb('2');
						setSupportsAvatarUploadLimit(false);
					}
				} catch (error) {
					if (!mounted.current) return;
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				if (mounted.current) setIsLoading(false);
			}
		);
	}, []);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

	const revertChanges = () => {
		setEnableGravatar(originalEnableGravatar);
		setAvatarMaxUploadSizeMb(originalAvatarMaxUploadSizeMb);
		setErrorMessage(undefined);
	};

	const saveSettings = async () => {
		const manager = useClientManager.getState();
		const client = manager.client;
		if (!client) return;

		let limit = avatarMaxUploadSizeMb;
		if (supportsAvatarUploadLimit) {
			const trimmed = avatarMaxUploadSizeMb.trim();
			const uploadLimit = /^[+-]?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
			if (!Number.isInteger(uploadLimit) || uploadLimit < 1 || uploadLimit > 50) {
				setErrorMessage('Maximum Upload Size must be between 1 and 50 MB.');
				return;
			}
			limit = String(uploadLimit);
			setAvatarMaxUploadSizeMb(limit);
		}

		const changedSettings: Record<string, string> = {};
		if (enableGravatar !== originalEnableGravatar)
			changedSettings.enableGravatar = String(enableGravatar);
		if (supportsAvatarUploadLimit && limit !== originalAvatarMaxUploadSizeMb)
			changedSettings.avatarMaxUploadSizeMb = limit;
		if (Object.keys(changedSettings).length === 0) return;

		setIsSaving(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const path = client.rest.environmentPath(EnvironmentID.localDocker, 'settings');
					await client.rest.put<PublicSetting[]>(path, { body: changedSettings });
					if (!mounted.current) return;

					const gravatarChanged = changedSettings.enableGravatar !== undefined;
					setOriginalEnableGravatar(enableGravatar);
					setOriginalAvatarMaxUploadSizeMb(limit);
					showToast(Toasts.success('User settings saved'));

					if (gravatarChanged) await manager.refreshCurrentUserAvatar(true);
				} catch (error) {
					if (!mounted.current) return;
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				if (mounted.current) setIsSaving(false);
			}
		);
	};

	return {
		enableGravatar,
		setEnableGravatar,
		avatarMaxUploadSizeMb,
		setAvatarMaxUploadSizeMb,
		supportsAvatarUploadLimit,
		isLoading,
		isSaving,
		errorMessage,
		hasChanges,
		load: loadSettings,
		revertChanges,
		save: () => void saveSettings()
	};
}
