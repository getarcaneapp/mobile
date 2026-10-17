/** `ProjectFileDialogView` state (ProjectFilesWorkspaceView.swift): name + destination for create / rename / move. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ProjectFileDialogInfo, type ProjectFileDialog } from './project-files-model';
import { routePayloads, type ProjectFileDialogPayload } from './project-routes';

const fallbackDialog: ProjectFileDialog = { kind: 'createFile', parentPath: '' };

export function useProjectFileDialog() {
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => routePayloads.get<ProjectFileDialogPayload>(token));
	useEffect(() => () => routePayloads.delete(token), [token]);

	const dialog = payload?.dialog ?? fallbackDialog;
	const [name, setName] = useState(() => ProjectFileDialogInfo.initialName(dialog));
	const [destinationPath, setDestinationPath] = useState(() =>
		ProjectFileDialogInfo.initialDestination(dialog)
	);
	const [errorMessage, setErrorMessage] = useState<string>();

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	return {
		dialog,
		title: ProjectFileDialogInfo.title(dialog),
		actionTitle: ProjectFileDialogInfo.actionTitle(dialog),
		needsName: ProjectFileDialogInfo.needsName(dialog),
		needsDestination: ProjectFileDialogInfo.needsDestination(dialog),
		nameSectionTitle: ProjectFileDialogInfo.nameSectionTitle(dialog),
		namePlaceholder: ProjectFileDialogInfo.namePlaceholder(dialog),
		destinationFolders: ProjectFileDialogInfo.moveDestinationFolders(
			dialog,
			payload?.folders ?? []
		),
		name,
		setName,
		destinationPath,
		setDestinationPath,
		errorMessage,
		cancel: dismiss,
		submit: () => {
			const message = payload?.onSubmit(
				ProjectFileDialogInfo.result(dialog, name, destinationPath)
			);
			if (message !== undefined) setErrorMessage(message);
			else dismiss();
		}
	};
}
