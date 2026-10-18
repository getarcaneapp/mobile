import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import { Permission } from '@/sdk/models/role/Permission';
import type {
	SwarmStackRenderConfigResponse,
	SwarmStackSource,
	SwarmStackSummary
} from '@/sdk/models/swarm/SwarmStack';
import { useClientManager } from '@/stores/client-manager';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import {
	useDeleteConfirmation,
	useItemDeleteConfirmation
} from '@/ui/components/delete-confirmation';
import type { ScrollableTabOption } from '@/ui/components/scrollable-tab-bar.types';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { useDebounced } from '@/features/containers/hooks';

import { plural, swarmChanged, useCan } from './swarm-common';
import { useSwarmNavigation } from './swarm-routes';
import { useSwarmPagedList } from './use-swarm-list';

export function useSwarmStacks(environmentID: EnvironmentID) {
	const swarm = useSwarmNavigation();
	const can = useCan(environmentID);
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);
	const [pendingDelete, setPendingDelete] = useState<SwarmStackSummary>();
	const paged = useSwarmPagedList<SwarmStackSummary>(
		environmentID,
		(client, { envID, search, start, limit }) =>
			client.swarm.listStacks({ envID, search, start, limit }),
		debouncedSearch
	);
	const canManage = can(Permission.Swarm.stacks);

	const deleteStack = async (stack: SwarmStackSummary) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			await client.swarm.deleteStack({ name: stack.name, envID: environmentID });
			paged.list.updateItems((items) => items.filter((item) => item.value.id !== stack.id));
			swarmChanged(environmentID);
			showToast(Toasts.success('Stack deleted'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (stack) => ({
		title: 'Delete Stack',
		message: `Delete “${stack.name}” and remove its services?`,
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => void deleteStack(stack) }],
		dismissOnConfirm: false
	}));

	return {
		...paged,
		environmentID,
		setSearchText,
		canManage,
		emptyTitle: debouncedSearch === '' ? 'No Stacks' : 'No Results',
		servicesText: (stack: SwarmStackSummary) =>
			`${stack.services} service${stack.services === 1 ? '' : 's'}`,
		openDetail: (stack: SwarmStackSummary) => swarm.openStack(environmentID, stack.name),
		openCreate: () => swarm.openStackEditor(environmentID),
		requestDelete: (stack: SwarmStackSummary) => setPendingDelete(stack)
	};
}

export type SwarmStacksModel = ReturnType<typeof useSwarmStacks>;

export type StackDetailTab = 'services' | 'tasks' | 'source';

export function useSwarmStackDetail() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const environmentID = envID;
	const swarm = useSwarmNavigation();
	const accent = useAccentColor();
	const can = useCan(environmentID);
	const [selectedTab, setSelectedTab] = useState<StackDetailTab>('services');
	const [source, setSource] = useState<SwarmStackSource>();
	const [sourceError, setSourceError] = useState<string>();
	const [runningActionID, setRunningActionID] = useState<string>();
	const canManage = can(Permission.Swarm.stacks);

	const tabs: ScrollableTabOption<StackDetailTab>[] = [
		{
			value: 'services' as const,
			title: 'Services',
			systemImage: 'shippingbox.fill',
			tint: systemColors.blue
		},
		{
			value: 'tasks' as const,
			title: 'Tasks',
			systemImage: 'checklist',
			tint: systemColors.purple
		},
		{ value: 'source' as const, title: 'Source', systemImage: 'doc.text', tint: systemColors.teal }
	].filter((tab) => tab.value !== 'source' || canManage);

	const loadSource = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			setSource(await client.swarm.stackSource({ name, envID: environmentID }));
			setSourceError(undefined);
		} catch (error) {
			setSourceError(friendlyErrorMessage(error));
		}
	}, [name, environmentID]);

	const deleteStack = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setRunningActionID('delete');
		await withCleanup(
			async () => {
				try {
					await client.swarm.deleteStack({ name, envID: environmentID });
					swarmChanged(environmentID);
					showToast(Toasts.success('Stack deleted'));
				} catch (error) {
					showToast(Toasts.error(friendlyErrorMessage(error)));
				}
			},
			() => setRunningActionID(undefined)
		);
	};

	const primary: ActionButtonItem | undefined = canManage
		? {
				id: 'edit',
				title: 'Edit',
				systemImage: 'pencil',
				tint: accent,
				action: () => swarm.openStackEditor(environmentID, name)
			}
		: undefined;
	const overflow: ActionButtonItem[] = canManage
		? [
				{
					id: 'delete',
					title: 'Delete',
					systemImage: 'trash',
					tint: systemColors.red,
					role: 'destructive',
					confirmationMessage: 'This removes every service in the stack.',
					action: () => void deleteStack()
				}
			]
		: [];

	return {
		environmentID,
		name,
		tabs,
		selectedTab,
		setSelectedTab,
		source,
		sourceError,
		loadSource,
		canManage,
		toolbar: {
			primary,
			overflow,
			runningItemID: runningActionID,
			isDisabled: runningActionID !== undefined
		}
	};
}

export type SwarmStackDetailModel = ReturnType<typeof useSwarmStackDetail>;

export const resolveImageOptions = [
	{ label: 'Always', value: 'always' },
	{ label: 'Changed', value: 'changed' },
	{ label: 'Never', value: 'never' }
];

export function validationSummary(result: SwarmStackRenderConfigResponse) {
	return (
		`${result.services.length} ${plural(result.services.length, 'service')}, ` +
		`${result.networks.length} ${plural(result.networks.length, 'network')}, ` +
		`${result.volumes.length} ${plural(result.volumes.length, 'volume')}`
	);
}

export const stackEditorConfirmationHost = 'swarm-stack-editor';

function sourceEnvironment(source: SwarmStackSource): string {
	return source.envContent ?? '';
}

export function useSwarmStackEditor() {
	const router = useRouter();
	const { envID = '0', stack } = useLocalSearchParams<{ envID?: string; stack?: string }>();
	const environmentID = envID;
	const stackName = stack;
	const [name, setName] = useState('');
	const [compose, setCompose] = useState('');
	const [environment, setEnvironment] = useState('');
	const [originalCompose, setOriginalCompose] = useState('');
	const [originalEnvironment, setOriginalEnvironment] = useState('');
	const [prune, setPrune] = useState(false);
	const [withRegistryAuth, setWithRegistryAuth] = useState(false);
	const [resolveImage, setResolveImage] = useState('always');
	const [redeploy, setRedeploy] = useState(true);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isValidating, setIsValidating] = useState(false);
	const [validation, setValidation] = useState<SwarmStackRenderConfigResponse>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const [confirmDiscard, setConfirmDiscard] = useState(false);

	const isEditing = stackName !== undefined;
	const hasChanges =
		compose !== originalCompose ||
		environment !== originalEnvironment ||
		(!isEditing && name !== '');
	const trimmedName = name.trim();
	const canSave =
		isLoaded &&
		compose.trim() !== '' &&
		trimmedName !== '' &&
		(!isEditing || hasChanges || redeploy);
	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const load = useCallback(async () => {
		if (stackName === undefined) {
			setIsLoaded(true);
			return;
		}
		const client = useClientManager.getState().client;
		if (!client) return;
		setErrorMessage(undefined);
		try {
			const source = await client.swarm.stackSource({ name: stackName, envID: environmentID });
			setName(stackName);
			setCompose(source.composeContent);
			setEnvironment(sourceEnvironment(source));
			setOriginalCompose(source.composeContent);
			setOriginalEnvironment(sourceEnvironment(source));
			setIsLoaded(true);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		}
	}, [stackName, environmentID]);

	useEffect(() => {
		void load();
	}, [load]);

	const validate = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsValidating(true);
		setErrorMessage(undefined);
		const request = {
			name: trimmedName === '' ? 'stack' : trimmedName,
			composeContent: compose,
			envContent: environment === '' ? undefined : environment
		};
		await withCleanup(
			async () => {
				try {
					setValidation(
						await client.swarm.renderStackConfig({
							request,
							envID: environmentID
						})
					);
				} catch (error) {
					setValidation(undefined);
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsValidating(false)
		);
	};

	const save = async () => {
		const client = useClientManager.getState().client;
		if (!client || !canSave) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		const envContent = environment === '' ? undefined : environment;
		const shouldDeploy = !isEditing || redeploy;
		const successMessage = shouldDeploy ? 'Stack deployed' : 'Stack saved';
		await withCleanup(
			async () => {
				try {
					if (stackName !== undefined) {
						if (hasChanges) {
							await client.swarm.updateStackSource({
								name: stackName,
								request: { composeContent: compose, envContent },
								envID: environmentID
							});
						}
					}
					if (shouldDeploy) {
						await client.swarm.deployStack({
							request: {
								name: trimmedName,
								composeContent: compose,
								envContent,
								withRegistryAuth,
								prune,
								resolveImage
							},
							envID: environmentID
						});
					}
					swarmChanged(environmentID);
					showToast(Toasts.success(successMessage));
					dismiss();
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsSaving(false)
		);
	};

	useDeleteConfirmation(
		confirmDiscard,
		setConfirmDiscard,
		{
			title: 'Discard stack changes?',
			actions: [{ title: 'Discard Changes', action: dismiss }],
			cancelTitle: 'Keep Editing',
			dismissOnConfirm: false
		},
		stackEditorConfirmationHost
	);

	return {
		isEditing,
		name,
		setName,
		compose,
		setCompose,
		environment,
		setEnvironment,
		prune,
		setPrune,
		withRegistryAuth,
		setWithRegistryAuth,
		resolveImage,
		setResolveImage,
		redeploy,
		setRedeploy,
		isLoaded,
		isSaving,
		isValidating,
		validation,
		errorMessage,
		hasChanges,
		canSave,
		showsDeployOptions: !isEditing || redeploy,
		title: isEditing ? `Edit ${stackName ?? ''}` : 'Deploy Stack',
		saveTitle: isEditing ? (redeploy ? 'Deploy' : 'Save') : 'Deploy',
		load: () => void load(),
		validate: () => void validate(),
		save: () => void save(),
		cancel: () => {
			if (hasChanges) setConfirmDiscard(true);
			else dismiss();
		}
	};
}

export type SwarmStackEditorModel = ReturnType<typeof useSwarmStackEditor>;
