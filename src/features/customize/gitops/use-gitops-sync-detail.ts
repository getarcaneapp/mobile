import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { settingsPayloads } from '@/features/settings/shared/settings-routes';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { nonEmptyResourceValue } from '@/ui/components/resource-detail.types';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import {
	DynamicResource,
	escapedPathComponent,
	sendRequest
} from '../dynamic-resources/dynamic-resource';
import { useDynamicResourceNavigation } from '../dynamic-resources/dynamic-resource-routes';
import { GitOpsSyncDetails } from './gitops-sync-details';
import { gitOpsSyncEditConfig, type GitOpsSyncPayload } from './gitops-routes';

export function useGitOpsSyncDetail() {
	const nav = useDynamicResourceNavigation();
	const accent = useAccentColor();
	const params = useLocalSearchParams<{ id?: string; envID?: string; token?: string }>();
	const [payload] = useState(() => settingsPayloads.get<GitOpsSyncPayload>(params.token));
	const syncID = payload?.resource.id ?? params.id ?? '';
	const environmentID =
		payload?.environmentID ?? params.envID ?? useClientManager.getState().activeEnvironmentID;
	const onChange = payload?.onChange;

	const [sync, setSync] = useState(() =>
		payload
			? GitOpsSyncDetails.fromResource(payload.resource)
			: GitOpsSyncDetails.fromValues({}, syncID)
	);
	const [resource, setResource] = useState<DynamicResource>();
	const [runningActionID, setRunningActionID] = useState<string>();
	const environmentName = useEnvironmentsStore((s) => s.displayName(environmentID));

	const syncPath = useCallback(() => {
		const client = useClientManager.getState().client;
		return client?.rest.environmentPath(
			environmentID,
			`gitops-syncs/${escapedPathComponent(sync.id)}`
		);
	}, [environmentID, sync.id]);

	const reload = useCallback(async () => {
		const client = useClientManager.getState().client;
		const path = syncPath();
		if (!client || path === undefined) return;
		try {
			const loaded = await client.rest.get(path, { decode: DynamicResource.decode });
			setResource(loaded);
			setSync(GitOpsSyncDetails.fromResource(loaded));
		} catch (error) {
			if (!isCancellation(error)) showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	}, [syncPath]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const isBackup = GitOpsSyncDetails.isBackup(sync);

	const performSync = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setRunningActionID('sync');
		try {
			const result = await client.gitops.performSync({ id: sync.id, envID: environmentID });
			if (result.success) {
				showToast(Toasts.success(isBackup ? 'Backup completed' : 'Sync completed'));
			} else {
				showToast(Toasts.error(nonEmptyResourceValue(result.error) ?? result.message));
			}
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
		await reload();
		onChange?.();
		setRunningActionID(undefined);
	};

	const deleteSync = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setRunningActionID('delete');
		try {
			await client.gitops.deleteSync({ id: sync.id, envID: environmentID });
			showToast(Toasts.success(isBackup ? 'Backup stopped' : 'Sync deleted'));
			onChange?.();
			nav.back();
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		} finally {
			setRunningActionID(undefined);
		}
	};

	const presentEdit = () => {
		if (!resource) return;
		const config = gitOpsSyncEditConfig;
		nav.openForm({
			title: config.title,
			fields: config.fields,
			initial: resource,
			onSubmit: async (body) => {
				const client = useClientManager.getState().client;
				const path = syncPath();
				if (!client || path === undefined) return;
				await sendRequest(client, path, config.method, body);
				showToast(Toasts.success('Sync updated'));
				onChange?.();
				await reload();
			}
		});
	};

	const openURL = (url: string) => void Linking.openURL(url).catch(() => {});

	const copy = (value: string) => {
		void Clipboard.setStringAsync(value);
		showToast(Toasts.copied());
	};

	const openProject = () => {
		if (sync.projectID === undefined) return;
		nav.push(`project/${encodeURIComponent(sync.projectID)}`, {
			envID: environmentID,
			name: sync.projectName
		});
	};

	const repositoryWebURL = GitOpsSyncDetails.repositoryWebURL(sync);

	const syncAction: ActionButtonItem = isBackup
		? {
				id: 'sync',
				title: 'Back Up Now',
				systemImage: 'arrow.up.circle',
				tint: accent,
				action: () => void performSync()
			}
		: {
				id: 'sync',
				title: 'Sync Now',
				systemImage: 'arrow.triangle.2.circlepath',
				tint: accent,
				action: () => void performSync()
			};

	const overflowActions: ActionButtonItem[] = [];
	if (repositoryWebURL !== undefined) {
		overflowActions.push({
			id: 'open-repository',
			title: 'Open Repository',
			systemImage: 'arrow.up.right.square',
			tint: accent,
			action: () => openURL(repositoryWebURL)
		});
	}
	if (!isBackup && resource !== undefined) {
		overflowActions.push({
			id: 'edit',
			title: 'Edit',
			systemImage: 'pencil',
			tint: accent,
			action: presentEdit
		});
	}
	overflowActions.push(
		isBackup
			? {
					id: 'delete',
					title: 'Stop Backing Up',
					systemImage: 'xmark.circle',
					tint: systemColors.red,
					role: 'destructive',
					confirmationMessage:
						'Arcane stops backing this project up to Git. Local files and the repository history are kept.',
					action: () => void deleteSync()
				}
			: {
					id: 'delete',
					title: 'Delete Sync',
					systemImage: 'trash',
					tint: systemColors.red,
					role: 'destructive',
					confirmationMessage:
						'This removes the sync configuration. The project and its files are kept.',
					action: () => void deleteSync()
				}
	);

	return {
		sync,
		isBackup,
		status: GitOpsSyncDetails.statusPresentation(sync),
		visibleError: GitOpsSyncDetails.visibleError(sync),
		backupFailureDescription: GitOpsSyncDetails.backupFailureDescription(sync),
		targetLabel: GitOpsSyncDetails.targetLabel(sync),
		shortCommit: GitOpsSyncDetails.shortCommit(sync),
		commitURL: GitOpsSyncDetails.commitURL(sync),
		syncIntervalDescription: GitOpsSyncDetails.syncIntervalDescription(sync),
		projectLinks: sync.projectID !== undefined && !GitOpsSyncDetails.isSwarmStack(sync),
		repositoryWebURL,
		environmentName,
		runningActionID,
		syncAction,
		overflowActions,
		reload,
		openURL,
		copy,
		openProject
	};
}

export type GitOpsSyncDetailModel = ReturnType<typeof useGitOpsSyncDetail>;
