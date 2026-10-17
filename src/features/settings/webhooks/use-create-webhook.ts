import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { PaginationLoader } from '@/core/networking/pagination-loader';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { ProjectDetails } from '@/sdk/models/project/Project';
import type { CreateWebhook, WebhookCreated } from '@/sdk/models/webhook/Webhook';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';
import { containerDisplayName } from '@/features/containers/container-model';

import { settingsPayloads } from '../shared/settings-routes';
import {
	actionsForTarget,
	type CreateWebhookPayload,
	type WebhookActionType,
	type WebhookTargetType
} from './webhook-models';

export function useCreateWebhook() {
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const payload = settingsPayloads.get<CreateWebhookPayload>(token);
	const [name, setName] = useState('');
	const [targetType, setTargetTypeState] = useState<WebhookTargetType>('container');
	const [actionType, setActionType] = useState<WebhookActionType>('update');
	const [targetId, setTargetId] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [containers, setContainers] = useState<ContainerSummary[]>([]);
	const [projects, setProjects] = useState<ProjectDetails[]>([]);
	const [loadingTargets, setLoadingTargets] = useState(false);

	const needsTargetId = targetType !== 'updater';
	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const setTargetType = (next: WebhookTargetType) => {
		if (next === targetType) return;
		setTargetTypeState(next);
		setActionType(actionsForTarget(next)[0] ?? 'update');
		setTargetId('');
	};

	useEffect(() => {
		const manager = useClientManager.getState();
		const client = manager.client;
		if (!client) return;
		const envID = manager.activeEnvironmentID;
		setLoadingTargets(true);
		const containersResult = PaginationLoader.collect(async (start, limit) => {
			const response = await client.containers.list({ envID, query: { start, limit } });
			return { items: response.data, pagination: response.pagination };
		}).catch(() => undefined);
		const projectsResult = PaginationLoader.collect(async (start, limit) => {
			const response = await client.projects.list({ envID, query: { start, limit } });
			return { items: response.data, pagination: response.pagination };
		}).catch(() => undefined);
		void Promise.all([containersResult, projectsResult]).then(
			([loadedContainers, loadedProjects]) => {
				setContainers(loadedContainers ?? []);
				setProjects(loadedProjects ?? []);
				setLoadingTargets(false);
			}
		);
	}, []);

	const createWebhook = async () => {
		const manager = useClientManager.getState();
		const client = manager.client;
		if (!client) return;
		setIsLoading(true);
		setErrorMessage(undefined);
		try {
			const body: CreateWebhook = {
				actionType,
				name,
				targetId: needsTargetId ? targetId : '',
				targetType
			};
			const path = client.rest.environmentPath(manager.activeEnvironmentID, 'webhooks');
			const created = await client.rest.post<WebhookCreated>(path, { body });
			showToast(Toasts.success('Webhook created'));
			payload?.onCreated(created);
			dismiss();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	};

	return {
		name,
		setName,
		targetType,
		setTargetType,
		actionType,
		setActionType,
		actions: actionsForTarget(targetType),
		targetId,
		setTargetId,
		needsTargetId,
		loadingTargets,
		containerOptions: containers.map((container) => ({
			label: containerDisplayName(container),
			value: container.id
		})),
		projectOptions: projects.map((project) => ({ label: project.name, value: project.id })),
		errorMessage,
		createDisabled: name === '' || isLoading || (needsTargetId && targetId === ''),
		createWebhook: () => void createWebhook(),
		cancel: dismiss
	};
}

export type CreateWebhookModel = ReturnType<typeof useCreateWebhook>;
