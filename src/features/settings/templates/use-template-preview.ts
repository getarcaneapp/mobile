import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { withCleanup } from '@/core/with-cleanup';
import { hasPermission, usePermissionCheck } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { boundedAPIResponse, RemoteDataLimits } from '@/core/networking/remote-data-limits';
import { escapedPathComponent } from '@/core/networking/server-identity';
import { useProjectNavigation } from '@/features/projects/project-routes';
import { projectNameFromTemplate } from '@/features/projects/project-model';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import { Permission } from '@/sdk/models/role/Permission';
import type { Template, TemplateContent } from '@/sdk/models/template/Template';
import { useClientManager } from '@/stores/client-manager';
import { environmentDisplayName, useEnvironmentsStore } from '@/stores/environments-store';
import { useDeleteConfirmation } from '@/ui/components/delete-confirmation';
import type { ListEnvironment } from '@/ui/components/environment-label.types';
import { showToast, Toasts } from '@/ui/toast';

import { useTemplatePermissions } from './template-permissions';
import {
	useRoutePayload,
	useTemplateNavigation,
	type TemplatePreviewPayload
} from './template-routes';

export type TemplateFileTab = 'compose' | 'env';

function loadBoundedContent(client: ArcaneClient, id: string): Promise<TemplateContent> {
	return boundedAPIResponse<TemplateContent>(
		client,
		`templates/${escapedPathComponent(id)}/content`,
		{
			maximumBytes: RemoteDataLimits.maximumTemplateBytes
		}
	);
}

const currentSession = () => useClientManager.getState().cacheSessionIdentity;

export function useTemplatePreview() {
	const { payload, params } = useRoutePayload<TemplatePreviewPayload>();
	const template = payload?.template;
	const templateID = template?.id ?? params.id ?? '';
	const onChange = useCallback(async () => {
		await payload?.onChange();
	}, [payload]);

	const router = useRouter();
	const templateNavigation = useTemplateNavigation();
	const projectNavigation = useProjectNavigation();
	const client = useClientManager((s) => s.client);
	const cacheSessionIdentity = useClientManager((s) => s.cacheSessionIdentity);
	const allEnvironmentsPreview = useClientManager((s) => s.allEnvironmentsPreview);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const environments = useEnvironmentsStore((s) => s.environments);
	const permissions = useTemplatePermissions();
	const can = usePermissionCheck();

	const [downloadedTemplate, setDownloadedTemplate] = useState<Template>();
	const [content, setContent] = useState<TemplateContent>();
	const [selectedTab, setSelectedTab] = useState<TemplateFileTab>('compose');
	const [isLoading, setIsLoading] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [loadedSessionIdentity, setLoadedSessionIdentity] = useState<string>();
	const loadedIdentityRef = useRef<string>(undefined);

	const displayedTemplate: Template | undefined =
		content?.template ?? downloadedTemplate ?? template;
	const displayedID = displayedTemplate?.id ?? templateID;
	const isRemote = displayedTemplate?.isRemote ?? false;
	const sessionMatches = loadedSessionIdentity === cacheSessionIdentity;
	const displayedIDRef = useRef(displayedID);
	useLayoutEffect(() => {
		displayedIDRef.current = displayedID;
	});

	const canEdit = sessionMatches && permissions.canRead && permissions.canUpdate;
	const canDelete = sessionMatches && permissions.canDelete;
	const canDownload = sessionMatches && permissions.canRead;

	const deployEnvironments: ListEnvironment[] = (
		allEnvironmentsPreview
			? environments
					.filter((environment) => environment.enabled)
					.map((environment) => ({ id: environment.id, name: environmentDisplayName(environment) }))
			: [{ id: activeEnvironmentID }]
	).filter((environment) => can(Permission.Projects.create, environment.id));
	const canDeploy = sessionMatches && deployEnvironments.length > 0;

	const loadContent = useCallback(async () => {
		if (!client) return;
		const identity = currentSession();
		if (loadedIdentityRef.current !== identity) {
			setContent(undefined);
			setDownloadedTemplate(undefined);
		}
		if (!hasPermission(Permission.Templates.read, null)) {
			setErrorMessage('Your role cannot read templates.');
			return;
		}
		setIsLoading(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const loaded = await loadBoundedContent(client, displayedIDRef.current);
					if (identity !== currentSession()) return;
					loadedIdentityRef.current = identity;
					setLoadedSessionIdentity(identity);
					setContent(loaded);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	}, [client]);

	useEffect(() => {
		void loadContent();
	}, [loadContent, templateID, cacheSessionIdentity]);

	useEffect(() => {
		if (allEnvironmentsPreview) void useEnvironmentsStore.getState().load();
	}, [allEnvironmentsPreview]);

	const dismiss = useCallback(() => {
		if (router.canGoBack()) router.back();
	}, [router]);

	const deleteTemplate = async () => {
		if (!client || isRemote || !canDelete || isDeleting) return;
		const identity = currentSession();
		setIsDeleting(true);
		await withCleanup(
			async () => {
				try {
					await client.templates.delete({ id: displayedID });
					if (identity !== currentSession()) return;
					showToast(Toasts.success('Template deleted'));
					await onChange();
					dismiss();
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setIsDeleting(false)
		);
	};

	useDeleteConfirmation(confirmDelete, setConfirmDelete, {
		title: 'Delete this local template?',
		icon: 'exclamationmark.triangle',
		actions: [{ title: 'Delete Template', action: () => void deleteTemplate() }],
		dismissOnConfirm: false
	});

	const downloadTemplate = async () => {
		if (!client || !isRemote || !canDownload) return;
		const identity = currentSession();
		setIsDownloading(true);
		await withCleanup(
			async () => {
				try {
					const downloaded = await client.templates.download({ id: displayedID });
					const loaded = await loadBoundedContent(client, downloaded.id);
					if (identity !== currentSession()) return;
					setDownloadedTemplate(loaded.template);
					setContent(loaded);
					showToast(Toasts.success('Template downloaded'));
					await onChange();
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setIsDownloading(false)
		);
	};

	const dismissAfterDeploy = useRef(false);
	useFocusEffect(
		useCallback(() => {
			if (!dismissAfterDeploy.current) return;
			dismissAfterDeploy.current = false;
			dismiss();
		}, [dismiss])
	);

	const deploy = (environmentID: string) => {
		if (!content || !displayedTemplate) return;
		projectNavigation.openCreate(environmentID, {
			prefilledName: projectNameFromTemplate(displayedTemplate.name),
			prefilledCompose: content.content,
			prefilledEnv: content.envContent,
			templateLabel: displayedTemplate.name,
			onSuccess: () => {
				dismissAfterDeploy.current = true;
			}
		});
	};

	const editTemplate = () => {
		if (!displayedTemplate) return;
		templateNavigation.openEditor({
			mode: { kind: 'edit', template: displayedTemplate },
			onSuccess: async () => {
				await loadContent();
				await onChange();
			}
		});
	};

	return {
		title: displayedTemplate?.name ?? '',
		displayedTemplate,
		isRemote,
		content,
		isLoading,
		isDownloading,
		isDeleting,
		errorMessage,
		selectedTab,
		setSelectedTab,
		canEdit,
		canDelete,
		canDownload,
		canDeploy,
		allEnvironmentsPreview,
		deployEnvironments,
		activeEnvironmentID,
		loadContent: () => void loadContent(),
		download: () => void downloadTemplate(),
		requestDelete: () => setConfirmDelete(true),
		editTemplate,
		deploy
	};
}

export type TemplatePreviewModel = ReturnType<typeof useTemplatePreview>;

export function templateSummaryAccessibility(template: Template, content: TemplateContent): string {
	const source = template.isRemote ? 'Remote' : 'Local';
	return `${source} template. ${content.services.length} services. ${content.envVariables.length} environment variables.`;
}

export const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
