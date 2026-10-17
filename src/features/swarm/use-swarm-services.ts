import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { Permission } from '@/sdk/models/role/Permission';
import type { SwarmServiceSummary } from '@/sdk/models/swarm/SwarmServices';
import { useClientManager } from '@/stores/client-manager';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { useDebounced } from '@/features/containers/hooks';
import { screenCache } from '@/features/networks/tab-routes';

import { capitalized, swarmChanged, useCan } from './swarm-common';
import { swarmKeys, useSwarmNavigation } from './swarm-routes';
import { useSwarmPagedList } from './use-swarm-list';

export const serviceIsHealthy = (
	service: Pick<SwarmServiceSummary, 'mode' | 'runningReplicas' | 'replicas'>
) => service.mode !== 'replicated' || service.runningReplicas >= service.replicas;

export const serviceModeTitle = (service: SwarmServiceSummary) => capitalized(service.mode);

export function useSwarmServices(environmentID: EnvironmentID, stackName?: string) {
	const swarm = useSwarmNavigation();
	const can = useCan(environmentID);
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);
	const [pendingDelete, setPendingDelete] = useState<SwarmServiceSummary>();
	const paged = useSwarmPagedList<SwarmServiceSummary>(
		environmentID,
		(client, { envID, search, start, limit }) =>
			stackName !== undefined
				? client.swarm.stackServices({ name: stackName, envID, start, limit })
				: client.swarm.listServices({ envID, search, start, limit }),
		debouncedSearch
	);

	const canManage = can(Permission.Swarm.services);
	const canReadLogs = can(Permission.Swarm.servicesLogs);

	const deleteService = async (service: SwarmServiceSummary) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			await client.swarm.deleteService({ serviceId: service.id, envID: environmentID });
			paged.list.updateItems((items) => items.filter((item) => item.value.id !== service.id));
			swarmChanged(environmentID);
			showToast(Toasts.success('Service deleted'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (service) => ({
		title: 'Delete Service',
		message: `Delete “${service.name}”? Its tasks are stopped and removed.`,
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => void deleteService(service) }],
		dismissOnConfirm: false
	}));

	return {
		...paged,
		environmentID,
		stackName,
		debouncedSearch,
		setSearchText,
		canManage,
		canReadLogs,
		emptyTitle: debouncedSearch === '' ? 'No Services' : 'No Results',
		showsStack: stackName === undefined,
		openDetail: (service: SwarmServiceSummary) => swarm.openService(environmentID, service),
		openCreate: () => swarm.openServiceEditor(environmentID),
		openScale: (service: SwarmServiceSummary) => swarm.openScale(environmentID, service),
		openLogs: (service: SwarmServiceSummary) => swarm.openServiceLogs(environmentID, service),
		requestDelete: (service: SwarmServiceSummary) => setPendingDelete(service)
	};
}

export type SwarmServicesModel = ReturnType<typeof useSwarmServices>;

export function useSwarmScale() {
	const router = useRouter();
	const { envID = '0', serviceID = '' } = useLocalSearchParams<{
		envID?: string;
		serviceID?: string;
	}>();
	const [service] = useState(() =>
		screenCache.get<SwarmServiceSummary>(swarmKeys.service(envID, serviceID))
	);
	const [replicas, setReplicas] = useState(() => service?.replicas ?? 0);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const scale = async () => {
		const client = useClientManager.getState().client;
		if (!client || !service) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			const response = await client.swarm.scaleService({
				serviceId: service.id,
				replicas: Math.max(0, replicas),
				envID
			});
			swarmChanged(envID);
			showToast(Toasts.success(`Scaled to ${replicas} replica${replicas === 1 ? '' : 's'}`));
			const warning = response.warnings?.[0];
			if (warning) showToast(Toasts.info(warning));
			dismiss();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	return {
		service,
		replicas,
		setReplicas: (value: number) => setReplicas(Math.min(Math.max(Math.round(value), 0), 1000)),
		isSaving,
		errorMessage,
		canScale: !isSaving && service !== undefined && replicas !== service.replicas,
		cancel: dismiss,
		scale: () => void scale()
	};
}
