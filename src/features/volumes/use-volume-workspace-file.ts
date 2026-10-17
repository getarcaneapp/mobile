import { Directory, File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import type { ProjectFile } from '@/sdk/models/project/ProjectFiles';
import { Permission } from '@/sdk/models/role/Permission';
import type { VolumeWorkspaceFileContent } from '@/sdk/models/volume/VolumeWorkspace';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { routePayloads, useVolumeNavigation, volumeCache } from './volume-routes';
import {
	downloadTo,
	makeTemporaryDirectory,
	removeItem,
	shareFile,
	useUnmounted,
	VolumeWorkspaceDraft
} from './volume-support';
import { useWorkspaceEntry, workspaceIdentity, WorkspaceStore } from './workspace-store';

export type WorkspaceReviewPayload = {
	latest: VolumeWorkspaceFileContent;
	onKeep: () => void;
};

export function useVolumeWorkspaceFile(
	environmentID: EnvironmentID,
	volumeName: string,
	relativePath: string
) {
	const router = useRouter();
	const nav = useVolumeNavigation();
	const unmounted = useUnmounted();
	const workspace = useWorkspaceEntry(environmentID, volumeName).workspace;
	const file: ProjectFile = volumeCache.workspaceFile(environmentID, volumeName, relativePath) ?? {
		path: relativePath,
		relativePath,
		name: relativePath.split('/').pop() ?? relativePath,
		isDirectory: false,
		size: 0
	};
	const [revision, setRevision] = useState(() => workspace?.fileTreeRevision ?? '');
	const [content, setContent] = useState<VolumeWorkspaceFileContent>();
	const [draft, setDraft] = useState<VolumeWorkspaceDraft>(VolumeWorkspaceDraft.empty);
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [download, setDownload] = useState<{ directory: Directory; file: File }>();
	const downloadRef = useRef(download);
	downloadRef.current = download;
	const generation = useClientManager((s) => s.clientGeneration);
	useClientManager((s) => s.accessGeneration);

	const fileIdentity = () => `${workspaceIdentity(environmentID, volumeName)}|${relativePath}`;
	const canEdit =
		content?.editable === true &&
		content.readOnlyReason === undefined &&
		hasPermission(Permission.Volumes.upload, environmentID);
	const hasChanges = VolumeWorkspaceDraft.hasChanges(draft);

	const load = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const key = `${workspaceIdentity(environmentID, volumeName)}|${relativePath}`;
		const isCurrent = () =>
			!unmounted.current &&
			key === `${workspaceIdentity(environmentID, volumeName)}|${relativePath}`;
		setLoading(true);
		try {
			const result = await client.volumes.workspaceFile({
				envID: environmentID,
				name: volumeName,
				relativePath
			});
			if (!isCurrent()) return;
			setContent(result);
			setDraft(VolumeWorkspaceDraft.load(result.content ?? ''));
		} catch (error) {
			if (isCurrent()) setErrorMessage(friendlyErrorMessage(error));
		} finally {
			if (isCurrent()) setLoading(false);
		}
	}, [environmentID, volumeName, relativePath, unmounted]);

	useEffect(() => {
		void load();
	}, [load, generation]);

	useEffect(() => () => removeItem(downloadRef.current?.directory), []);

	const save = async () => {
		const client = useClientManager.getState().client;
		if (!canEdit || loading || draft.conflict || !client) return;
		const key = fileIdentity();
		const isCurrent = () => !unmounted.current && key === fileIdentity();
		const directory = makeTemporaryDirectory();
		setLoading(true);
		try {
			const updated = new File(directory, 'updated');
			const baseline = new File(directory, 'baseline');
			updated.create();
			await updated.write(draft.text);
			baseline.create();
			await baseline.write(draft.baseline);
			const result = await client.volumes.updateWorkspace({
				envID: environmentID,
				name: volumeName,
				manifest: {
					fileTreeRevision: revision,
					fileChanges: [
						{ operation: 'update_file', relativePath, uploadIndex: 0, baselineIndex: 1 }
					]
				},
				files: [updated.uri, baseline.uri]
			});
			if (!isCurrent()) return;
			setRevision(result.fileTreeRevision);
			setDraft((d) => VolumeWorkspaceDraft.load(d.text));
			setErrorMessage(undefined);
			await WorkspaceStore.load(environmentID, volumeName);
			showToast(Toasts.success('File saved'));
		} catch (error) {
			if (!isCurrent()) return;
			if (isArcaneError(error, 'conflict')) {
				setDraft((d) => ({ ...d, conflict: true }));
				setErrorMessage('The server file changed. Review it before saving your draft.');
			} else {
				setErrorMessage(friendlyErrorMessage(error));
			}
		} finally {
			removeItem(directory);
			if (isCurrent()) setLoading(false);
		}
	};

	const reviewConflict = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const key = fileIdentity();
		const isCurrent = () => !unmounted.current && key === fileIdentity();
		try {
			const tree = await client.volumes.workspace({ envID: environmentID, name: volumeName });
			const latest = await client.volumes.workspaceFile({
				envID: environmentID,
				name: volumeName,
				relativePath
			});
			if (!isCurrent()) return;
			const latestRevision = tree.fileTreeRevision;
			const payload: WorkspaceReviewPayload = {
				latest,
				onKeep: () => {
					if (unmounted.current) return;
					setContent(latest);
					setDraft((d) => VolumeWorkspaceDraft.review(d, latest.content ?? ''));
					setRevision(latestRevision);
					setErrorMessage(undefined);
				}
			};
			nav.openWorkspaceReview(environmentID, volumeName, routePayloads.put(payload));
		} catch (error) {
			if (isCurrent()) setErrorMessage(friendlyErrorMessage(error));
		}
	};

	const downloadFile = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const key = fileIdentity();
		const directory = makeTemporaryDirectory();
		try {
			const target = new File(directory, file.name.split('/').pop() ?? file.name);
			const request = await client.volumes.downloadWorkspaceFileDownloadRequest({
				envID: environmentID,
				name: volumeName,
				relativePath
			});
			await downloadTo(request, target);
			if (unmounted.current || key !== fileIdentity()) {
				removeItem(directory);
				return;
			}
			setDownload({ directory, file: target });
		} catch (error) {
			removeItem(directory);
			if (key === fileIdentity() && !isCancellation(error))
				setErrorMessage(friendlyErrorMessage(error));
		}
	};

	return {
		file,
		content,
		draft,
		setText: (text: string) => setDraft((d) => ({ ...d, text })),
		loading,
		errorMessage,
		canEdit,
		hasChanges,
		readOnlyReason: content?.readOnlyReason?.replace(/_/g, ' '),
		hasText: content?.content !== undefined,
		downloaded: download !== undefined,
		canSave: !loading && hasChanges && !draft.conflict,
		save: () => void save(),
		reviewConflict: () => void reviewConflict(),
		download: () => void downloadFile(),
		share: () => {
			if (download)
				void shareFile(download.file).catch((error: unknown) =>
					showToast(Toasts.error(friendlyErrorMessage(error)))
				);
		},
		dismiss: () => router.back()
	};
}

export type VolumeWorkspaceFileModel = ReturnType<typeof useVolumeWorkspaceFile>;
