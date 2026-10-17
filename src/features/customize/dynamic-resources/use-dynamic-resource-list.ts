/**
 * The platform-neutral model behind `DynamicResourceListView`
 * (DynamicResourceViews.swift): a paginated list of backend resources from one
 * environment, every enabled environment (All Environments preview), or a
 * global endpoint, with search, row / page actions, create and edit forms.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { tabTitle, type AppTab } from '@/core/app-tab';
import { friendlyErrorMessage } from '@/core/errors';
import { useDebounced } from '@/features/containers/hooks';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import {
	useEnvironmentPagedList,
	type EnvironmentFetch,
	type EnvironmentItem
} from '@/stores/environment-paged-list';
import { useEnvironmentsStore, type ListEnvironment } from '@/stores/environments-store';
import { ListUX } from '@/ui/components/paginated-list.types';
import { showToast, Toasts } from '@/ui/toast';

import {
	caseInsensitiveContains,
	DynamicResource,
	escapedPathComponent,
	sendRequest,
	splitPath,
	standardCompare,
	type BackendFormField,
	type BackendListAction,
	type DynamicEditConfig
} from './dynamic-resource';
import { useDynamicResourceNavigation } from './dynamic-resource-routes';

const pageSize = 50;

export type DynamicResourceItem = EnvironmentItem<DynamicResource>;

export interface DynamicResourceListConfig {
	title: string;
	systemImage: string;
	/** The list endpoint in an environment. Global resources ignore the environment. */
	path: (environmentID: EnvironmentID, client: ArcaneClient) => string;
	/** The environment an environment-scoped list loads from; undefined for global resources. */
	environmentID?: EnvironmentID;
	/** All Environments preview: list and act on resources from every enabled environment. */
	allEnvironments?: boolean;
	emptyTitle?: string;
	actions?: BackendListAction[];
	createTitle?: string;
	createFields?: BackendFormField[];
	createPath?: (environmentID: EnvironmentID, client: ArcaneClient) => string;
	/** Adds Edit to rows and the generic detail page. */
	edit?: DynamicEditConfig;
	managementDestination?: AppTab;
	/**
	 * Replaces the generic detail page for a row. Receives the row and a
	 * callback that reloads the list after the page changes the resource.
	 */
	openDetail?: (item: DynamicResourceItem, onChange: () => void) => void;
}

/** A confirmed action, for a row or (when `item` is undefined) the whole page. */
export interface PendingAction {
	action: BackendListAction;
	item?: DynamicResourceItem;
}

export function useDynamicResourceList(config: DynamicResourceListConfig) {
	const nav = useDynamicResourceNavigation();
	const client = useClientManager((s) => s.client);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);
	const {
		title,
		environmentID,
		allEnvironments = false,
		actions = [],
		createFields = [],
		createPath,
		edit
	} = config;
	// Destinations pass inline closures; read the latest without re-running loads.
	const configRef = useRef(config);
	configRef.current = config;

	const [list, snapshot] = useEnvironmentPagedList<DynamicResource>(pageSize);
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, ListUX.searchDebounce);
	const [actionMessage, setActionMessage] = useState<string>();
	const [selectedAction, setSelectedAction] = useState<PendingAction>();

	/** Global resources load once through the active environment's client; their path ignores it. */
	const baseEnvironmentID = environmentID ?? activeEnvironmentID;
	const showsAllEnvironments = allEnvironments && environmentID !== undefined;

	/** The environments this list covers, known before the first load finishes. */
	const listEnvironments: ListEnvironment[] = showsAllEnvironments
		? snapshot.environments
		: [{ id: baseEnvironmentID }];

	const items = snapshot.items;
	const displayedItems = useMemo(
		() =>
			items
				.filter((item) => {
					if (debouncedSearch === '') return true;
					return (
						caseInsensitiveContains(DynamicResource.title(item.value), debouncedSearch) ||
						caseInsensitiveContains(DynamicResource.subtitle(item.value), debouncedSearch)
					);
				})
				.sort((lhs, rhs) =>
					standardCompare(DynamicResource.title(lhs.value), DynamicResource.title(rhs.value))
				),
		[items, debouncedSearch]
	);

	const resourcePath = (environment: EnvironmentID, current: ArcaneClient) =>
		splitPath(configRef.current.path(environment, current)).path;

	const resourcesPage = useCallback(
		(current: ArcaneClient, environments: ListEnvironment[]): EnvironmentFetch<DynamicResource> => {
			const path = configRef.current.path;
			const paths = new Map(
				environments.map((environment) => [environment.id, path(environment.id, current)])
			);
			return async (environment, start, limit) => {
				const target = paths.get(environment);
				if (target === undefined) throw new Error('Unknown environment');
				const { path: bare, query } = splitPath(target);
				if (debouncedSearch !== '') query.push({ name: 'search', value: debouncedSearch });
				const response = await current.rest.paginated(bare, {
					start,
					limit,
					query,
					decode: DynamicResource.decode
				});
				return { items: response.data, pagination: response.pagination };
			};
		},
		[debouncedSearch]
	);

	const load = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		const environments = await useEnvironmentsStore
			.getState()
			.listEnvironments(baseEnvironmentID, showsAllEnvironments);
		await list.reload(environments, resourcesPage(current, environments));
	}, [list, baseEnvironmentID, showsAllEnvironments, resourcesPage]);

	const loadMore = useCallback(async () => {
		const current = useClientManager.getState().client;
		if (!current) return;
		await list.loadMore(resourcesPage(current, list.getSnapshot().environments));
	}, [list, resourcesPage]);

	// `.task` + `.onChange(of: debouncedSearchText)`.
	useEffect(() => {
		void load();
	}, [load, client]);

	/** Stable reload callback for pushed pages that change a resource. */
	const loadRef = useRef(load);
	loadRef.current = load;
	const reload = useCallback(() => void loadRef.current(), []);

	const rowActions = actions.filter(
		(action) => action.requiresSelection && action.pathSuffix !== ''
	);
	const globalActions = actions.filter((action) => !action.requiresSelection);
	const canCreate = createPath !== undefined && createFields.length > 0;

	const itemPath = (item: DynamicResourceItem, current: ArcaneClient) =>
		`${resourcePath(item.environmentID, current)}/${escapedPathComponent(item.value.id)}`;

	/** Row actions target the row's environment; page-wide actions target the list's own environment. */
	const actionPath = (pending: PendingAction, current: ArcaneClient) => {
		const base = resourcePath(pending.item?.environmentID ?? baseEnvironmentID, current);
		const suffix = pending.item
			? pending.action.pathSuffix.replaceAll('{id}', escapedPathComponent(pending.item.value.id))
			: pending.action.pathSuffix;
		return suffix.startsWith('/') ? base + suffix : suffix;
	};

	const run = async (pending: PendingAction) => {
		const current = useClientManager.getState().client;
		if (!current) return;
		setSelectedAction(undefined);
		try {
			await sendRequest(current, actionPath(pending, current), pending.action.method);
			setActionMessage(`${pending.action.title} completed`);
			await load();
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	const presentCreate = (createEnvironmentID?: EnvironmentID) => {
		if (!createPath) return;
		const createEnvironment = createEnvironmentID ?? baseEnvironmentID;
		nav.openForm({
			title: config.createTitle ?? `Create ${title}`,
			fields: createFields,
			onSubmit: async (body) => {
				const current = useClientManager.getState().client;
				if (!current) return;
				await sendRequest(current, createPath(createEnvironment, current), 'POST', body);
				await loadRef.current();
			}
		});
	};

	const presentEdit = (item: DynamicResourceItem) => {
		if (!edit) return;
		nav.openForm({
			title: edit.title,
			fields: edit.fields,
			initial: item.value,
			onSubmit: async (body) => {
				const current = useClientManager.getState().client;
				if (!current) return;
				await sendRequest(current, itemPath(item, current), edit.method, body);
				showToast(Toasts.success('Saved'));
				await loadRef.current();
			}
		});
	};

	const openDetail = (item: DynamicResourceItem) => {
		if (config.openDetail) {
			config.openDetail(item, reload);
			return;
		}
		const current = useClientManager.getState().client;
		nav.openDetail({
			title: DynamicResource.title(item.value),
			resource: item.value,
			actions: rowActions,
			basePath: current ? resourcePath(item.environmentID, current) : undefined,
			edit,
			onChange: reload
		});
	};

	const managementDestination = config.managementDestination;
	const openManagement = () => {
		if (managementDestination) nav.push(managementDestination);
	};

	/** The alert's message: `"<Action> <Title>?"`, or `"<Action>?"` for page actions. */
	const selectedActionMessage = selectedAction
		? selectedAction.item
			? `${selectedAction.action.title} ${DynamicResource.title(selectedAction.item.value)}?`
			: `${selectedAction.action.title}?`
		: '';

	return {
		title,
		systemImage: config.systemImage,
		emptyTitle: config.emptyTitle ?? `No ${title}`,
		createTitle: config.createTitle ?? 'Create',
		snapshot,
		items,
		displayedItems,
		searchText,
		setSearchText,
		actionMessage,
		selectedAction,
		selectedActionMessage,
		setSelectedAction,
		showsAllEnvironments,
		listEnvironments,
		rowActions,
		globalActions,
		canEdit: edit !== undefined,
		canCreate,
		managementTitle: managementDestination
			? `Manage ${tabTitle[managementDestination]}`
			: undefined,
		load,
		loadMore,
		run,
		presentCreate,
		presentEdit,
		openDetail,
		openManagement
	};
}

export type DynamicResourceListModel = ReturnType<typeof useDynamicResourceList>;
