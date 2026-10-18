import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { boundedAPIResponse, RemoteDataLimits } from '@/core/networking/remote-data-limits';
import { withCleanup } from '@/core/with-cleanup';
import { cachedClient } from '@/core/networking/use-cached-client';
import { storage } from '@/core/storage';
import { makeComposePreviewSession } from '@/features/compose/model/compose-preview-session';
import {
	ProjectDraftReview,
	snapshotsEqual,
	type ProjectDraftSnapshot
} from '@/features/compose/model/project-draft-snapshot';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { DeployOptions } from '@/sdk/models/project/Project';
import { Permission } from '@/sdk/models/role/Permission';
import type { Template, TemplateContent } from '@/sdk/models/template/Template';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';
import { useProjectDeploymentStore } from '@/stores/project-deployment-store';
import { useResourceMutationStore } from '@/stores/resource-mutation-store';
import { useDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import {
	defaultComposeStarter,
	projectDisplayName,
	projectNameFromTemplate
} from './project-model';
import { routePayloads, useProjectNavigation, type CreateProjectPayload } from './project-routes';

export const createProjectConfirmationHost = 'create-project';

function announceCreatedProject(
	envID: string,
	created: { id: string; name: string },
	deploy: boolean,
	deployOptions: DeployOptions | undefined
) {
	if (deploy && hasPermission(Permission.Projects.deploy, envID)) {
		const started = useProjectDeploymentStore.getState().start({
			kind: 'up',
			envID,
			targetID: created.id,
			targetName: projectDisplayName(created),
			environmentName:
				useEnvironmentsStore.getState().displayName(envID) ??
				useClientManager.getState().activeEnvironmentName,
			deployOptions
		});
		if (!started) showToast(Toasts.info('Project created. Open the project to retry deployment.'));
	} else {
		showToast(Toasts.success('Project created'));
	}
}

function invalidateProjectsCache(client: ArcaneClient, envID: string) {
	cachedClient()?.invalidate(envID, [
		client.rest.environmentPath(envID, 'projects') + '*',
		client.rest.environmentPath(envID, 'projects/*')
	]);
}

async function notifyCreated(payload: CreateProjectPayload) {
	await payload.onSuccess?.();
}

function conversionSucceeded(isCurrent: () => boolean, result: { success: boolean }) {
	return isCurrent() && result.success;
}

async function loadTemplateList(
	client: ArcaneClient,
	handlers: {
		isCancelled: () => boolean;
		isCurrent: () => boolean;
		setTemplates: (templates: Template[]) => void;
		setErrorMessage: (message: string) => void;
		setIsLoadingTemplates: (loading: boolean) => void;
	}
) {
	try {
		const loaded = await client.templates.listAll();
		if (!handlers.isCancelled() && handlers.isCurrent()) handlers.setTemplates(loaded);
	} catch (error) {
		if (!handlers.isCancelled()) handlers.setErrorMessage(friendlyErrorMessage(error));
	} finally {
		if (!handlers.isCancelled()) handlers.setIsLoadingTemplates(false);
	}
}

async function pickComposeFile(isCurrent: () => boolean, onPicked: (text: string) => void) {
	try {
		const result = await File.pickFileAsync();
		if (result.canceled || !isCurrent()) return;
		const file = result.result;
		if ((file.size ?? 0) > RemoteDataLimits.maximumTemplateBytes) {
			showToast(Toasts.error('The YAML file exceeds the template size limit.'));
			return;
		}
		let text: string;
		try {
			text = await file.text();
		} catch {
			text = '\u{FFFD}';
		}
		if (text.includes('\u{FFFD}') || text.length > RemoteDataLimits.maximumTemplateBytes) {
			showToast(Toasts.error('Choose a UTF-8 YAML file within the template size limit.'));
			return;
		}
		onPicked(text);
	} catch (error) {
		if (!isCancellation(error)) showToast(Toasts.error(friendlyErrorMessage(error)));
	}
}

export function useCreateProject() {
	const router = useRouter();
	const nav = useProjectNavigation();
	const { envID = '0', token } = useLocalSearchParams<{ envID?: string; token?: string }>();
	const [payload] = useState<CreateProjectPayload>(
		() => routePayloads.get<CreateProjectPayload>(token) ?? {}
	);
	useEffect(() => () => routePayloads.delete(token), [token]);

	const [name, setName] = useState(payload.prefilledName ?? '');
	const [composeContent, setComposeContent] = useState(
		payload.prefilledCompose ?? defaultComposeStarter
	);
	const [envContent, setEnvContent] = useState(payload.prefilledEnv ?? '');
	const [templates, setTemplates] = useState<Template[]>([]);
	const [selectedTemplateID, setSelectedTemplateID] = useState('');
	const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [sessionIdentity] = useState(() => useClientManager.getState().cacheSessionIdentity);
	useClientManager((s) => s.accessGeneration);
	const currentSession = useClientManager((s) => s.cacheSessionIdentity);

	const [previewSession] = useState(() => makeComposePreviewSession(storage.bool));
	const previewEnabled = previewSession.isEnabled;
	const [baseline, setBaseline] = useState<ProjectDraftSnapshot>(() => ({
		compose: composeContent,
		environment: envContent
	}));
	const [showDiscard, setShowDiscard] = useState(false);
	const [pendingTemplateID, setPendingTemplateID] = useState<string>();
	const [showReplaceTemplate, setShowReplaceTemplate] = useState(false);
	const [importedCompose, setImportedCompose] = useState('');
	const [showReplaceImport, setShowReplaceImport] = useState(false);
	const [showDockerRun, setShowDockerRun] = useState(false);
	const [dockerRun, setDockerRun] = useState('');

	const isPrefilled = payload.prefilledCompose !== undefined;
	const canBrowseTemplates = useClientManager(
		() =>
			hasPermission(Permission.Templates.list, null) &&
			hasPermission(Permission.Templates.read, null)
	);
	const acceptsEnvironmentContext = useClientManager((s) => s.acceptsEnvironmentContext(envID));
	const canCreatePermission = useClientManager(() =>
		hasPermission(Permission.Projects.create, envID)
	);
	const sessionIsCurrent = () =>
		sessionIdentity === useClientManager.getState().cacheSessionIdentity &&
		useClientManager.getState().acceptsEnvironmentContext(envID);
	const selectedTemplate = templates.find((template) => template.id === selectedTemplateID);
	const draftSnapshot: ProjectDraftSnapshot = { compose: composeContent, environment: envContent };
	const hasDraftChanges =
		name !== (payload.prefilledName ?? '') ||
		composeContent !== (payload.prefilledCompose ?? defaultComposeStarter) ||
		envContent !== (payload.prefilledEnv ?? '');

	const latest = useRef({ name, draftSnapshot, selectedTemplateID });
	useLayoutEffect(() => {
		latest.current = { name, draftSnapshot, selectedTemplateID };
	});

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const loadDefaultTemplate = async () => {
		const client = useClientManager.getState().client;
		if (!sessionIsCurrent() || !client) return;
		const requestedFrom = latest.current.draftSnapshot;
		const session = useClientManager.getState().cacheSessionIdentity;
		let defaults;
		try {
			defaults = await client.templates.getDefaults();
		} catch {
			return;
		}
		if (
			!sessionIsCurrent() ||
			!ProjectDraftReview.canApplyLoadedContent(
				latest.current.draftSnapshot,
				requestedFrom,
				session,
				useClientManager.getState().cacheSessionIdentity
			) ||
			latest.current.selectedTemplateID !== ''
		) {
			return;
		}
		const compose =
			defaults.composeTemplate !== ''
				? defaults.composeTemplate
				: latest.current.draftSnapshot.compose;
		setComposeContent(compose);
		setEnvContent(defaults.envTemplate);
		setBaseline({ compose, environment: defaults.envTemplate });
	};

	const startInitialLoad = useEffectEvent(() => {
		if (isPrefilled || !canBrowseTemplates) return undefined;
		const client = useClientManager.getState().client;
		if (!client) return undefined;
		let cancelled = false;
		const isCancelled = () => cancelled;
		void (async () => {
			if (previewEnabled) await loadDefaultTemplate();
			if (cancelled) return;
			setIsLoadingTemplates(true);
			await loadTemplateList(client, {
				isCancelled,
				isCurrent: sessionIsCurrent,
				setTemplates,
				setErrorMessage,
				setIsLoadingTemplates
			});
		})();
		return () => {
			cancelled = true;
		};
	});

	useEffect(() => startInitialLoad(), []);

	const applyTemplate = async (id: string) => {
		if (!sessionIsCurrent()) return;
		if (id === '') {
			setComposeContent(defaultComposeStarter);
			setEnvContent('');
			setBaseline({ compose: defaultComposeStarter, environment: '' });
			return;
		}
		const client = useClientManager.getState().client;
		if (!canBrowseTemplates || !client) return;
		setIsLoading(true);
		await withCleanup(
			async () => {
				try {
					const content = await boundedAPIResponse<TemplateContent>(
						client,
						`templates/${encodeURIComponent(id)}/content`,
						{
							maximumBytes: RemoteDataLimits.maximumTemplateBytes
						}
					);
					if (!sessionIsCurrent()) return;
					setComposeContent(content.content);
					setEnvContent(content.envContent);
					setBaseline({ compose: content.content, environment: content.envContent });
					if (latest.current.name === '') setName(projectNameFromTemplate(content.template.name));
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	};

	const createProject = async (deploy = false, deployOptions?: DeployOptions) => {
		const client = useClientManager.getState().client;
		if (!sessionIsCurrent() || !hasPermission(Permission.Projects.create, envID) || !client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					if (previewEnabled) ProjectDraftReview.validateSyntax(latest.current.draftSnapshot);
					const created = await client.projects.create({
						envID,
						request: {
							name: latest.current.name,
							composeContent: latest.current.draftSnapshot.compose,
							envContent: latest.current.draftSnapshot.environment
						}
					});
					if (!sessionIsCurrent()) return;
					announceCreatedProject(envID, created, deploy, deployOptions);
					invalidateProjectsCache(client, envID);
					useResourceMutationStore.getState().markChanged('projects', envID);
					await notifyCreated(payload);
					dismiss();
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	};

	const review = () =>
		nav.openDraftReview({
			originalCompose: '',
			compose: composeContent,
			environmentChanged: envContent !== '',
			additionalChanges: [],
			saveTitle: 'Create Project',
			canDeploy: hasPermission(Permission.Projects.deploy, envID),
			onDismiss: (deploy) => {
				if (deploy && useClientManager.getState().supportsPost26MobileFeatures) {
					nav.openDeployOptions(envID, { deploy: (options) => void createProject(true, options) });
				} else {
					void createProject(deploy);
				}
			}
		});

	const importYAMLFile = async () => {
		if (!sessionIsCurrent()) return;
		await pickComposeFile(sessionIsCurrent, (text) => {
			setImportedCompose(text);
			setShowReplaceImport(true);
		});
	};

	const convertDockerRun = async () => {
		const client = useClientManager.getState().client;
		if (!sessionIsCurrent() || !client) return;
		setIsLoading(true);
		await withCleanup(
			async () => {
				try {
					const result = await client.system.convertDockerRun({
						request: { dockerRunCommand: dockerRun },
						envID
					});
					if (!conversionSucceeded(sessionIsCurrent, result)) {
						showToast(Toasts.error('Command conversion failed.'));
						return;
					}
					setComposeContent(result.dockerCompose);
					setEnvContent(result.envVars);
					if (latest.current.name === '') setName(result.serviceName);
					setShowDockerRun(false);
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setIsLoading(false)
		);
	};

	useDeleteConfirmation(
		showDiscard,
		setShowDiscard,
		{
			title: 'Discard project draft?',
			actions: [{ title: 'Discard', action: dismiss }],
			dismissOnConfirm: false
		},
		createProjectConfirmationHost
	);
	useDeleteConfirmation(
		showReplaceTemplate,
		setShowReplaceTemplate,
		{
			title: 'Replace Compose and environment drafts?',
			actions: [
				{
					title: 'Replace',
					action: () => {
						if (pendingTemplateID === undefined) return;
						setSelectedTemplateID(pendingTemplateID);
						void applyTemplate(pendingTemplateID);
					}
				}
			],
			dismissOnConfirm: false
		},
		createProjectConfirmationHost
	);
	useDeleteConfirmation(
		showReplaceImport,
		setShowReplaceImport,
		{
			title: 'Replace the Compose draft?',
			actions: [
				{
					title: 'Replace',
					action: () => {
						if (sessionIsCurrent()) setComposeContent(importedCompose);
					}
				}
			],
			dismissOnConfirm: false
		},
		createProjectConfirmationHost
	);

	return {
		environmentID: envID,
		previewEnabled,
		name,
		setName,
		composeContent,
		setComposeContent,
		envContent,
		setEnvContent,
		templates,
		selectedTemplateID,
		selectedTemplate,
		selectTemplate: (id: string) => {
			if (previewEnabled && !snapshotsEqual(draftSnapshot, baseline)) {
				setPendingTemplateID(id);
				setShowReplaceTemplate(true);
			} else {
				setSelectedTemplateID(id);
				void applyTemplate(id);
			}
		},
		isLoadingTemplates,
		isLoading,
		errorMessage,
		isPrefilled,
		templateLabel: payload.templateLabel,
		canBrowseTemplates,
		canCreate:
			name !== '' &&
			sessionIdentity === currentSession &&
			acceptsEnvironmentContext &&
			canCreatePermission,
		dismissDisabled: previewEnabled && hasDraftChanges,
		cancel: () => (previewEnabled && hasDraftChanges ? setShowDiscard(true) : dismiss()),
		create: () => (previewEnabled ? review() : void createProject()),
		openVariables: () =>
			nav.openRenderCompose(envID, {
				initialCompose: composeContent,
				initialEnv: envContent,
				onApply: setComposeContent
			}),
		importYAMLFile: () => void importYAMLFile(),
		showDockerRun,
		setShowDockerRun,
		dockerRun,
		setDockerRun,
		convertDockerRun: () => void convertDockerRun()
	};
}

export type CreateProjectModel = ReturnType<typeof useCreateProject>;
