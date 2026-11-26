import { useAdvancedFeatures } from '@/core/advanced-features';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import {
	QuadletDetail,
	QuadletInstallReport,
	type QuadletAction
} from '@/sdk/models/podman/Quadlet';
import { Permission } from '@/sdk/models/role/Permission';
import { useClientManager } from '@/stores/client-manager';
import { systemColors } from '@/theme/colors';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { useDebounced, useOnChange } from '@/features/containers/hooks';
import { screenCache } from '@/features/networks/tab-routes';

import { podmanChanged, usePodmanCan, usePodmanVersion } from './podman-common';
import {
	podmanStateLabel,
	quadletActionInfo,
	quadletActions,
	quadletFileNameError
} from './podman-logic';
import { podmanKeys, usePodmanNavigation } from './podman-routes';
import type { PodmanMenuAction } from './podman-parts.types';
import { usePodmanPagedList } from './use-podman-list';

export type QuadletRow = QuadletDetail & { id: string };

async function runQuadletAction(environmentID: EnvironmentID, name: string, action: QuadletAction) {
	const client = useClientManager.getState().client;
	if (!client) return false;
	try {
		const unit = await client.podman.quadletAction({ name, action, envID: environmentID });
		podmanChanged(environmentID);
		showToast(
			Toasts.success(
				unit.activeState
					? `${name}: ${unit.activeState}${unit.subState ? ` (${unit.subState})` : ''}`
					: `${quadletActionInfo[action].title}: ${name}`
			)
		);
		return true;
	} catch (error) {
		showToast(Toasts.error(friendlyErrorMessage(error)));
		return false;
	}
}

async function removeQuadlet(environmentID: EnvironmentID, name: string) {
	const client = useClientManager.getState().client;
	if (!client) return false;
	try {
		const report = await client.podman.removeQuadlet({ name, envID: environmentID });
		const failure = Object.entries(report.errors)[0];
		podmanChanged(environmentID);
		if (failure) {
			showToast(Toasts.error(`${failure[0]}: ${failure[1]}`));
			return false;
		}
		showToast(Toasts.success('Quadlet removed'));
		return true;
	} catch (error) {
		showToast(Toasts.error(friendlyErrorMessage(error)));
		return false;
	}
}

export const quadletSubtitle = (quadlet: QuadletDetail) =>
	[podmanStateLabel(quadlet.type), quadlet.app].filter(Boolean).join(' · ');

export function usePodmanQuadlets() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const environmentID = envID;
	const podman = usePodmanNavigation();
	const can = usePodmanCan(environmentID);
	const [advanced] = useAdvancedFeatures();
	const [searchText, setSearchText] = useState('');
	const debouncedSearch = useDebounced(searchText, 200);
	const [pendingDelete, setPendingDelete] = useState<QuadletRow>();
	const paged = usePodmanPagedList<QuadletRow>(
		environmentID,
		async (client, args) => {
			const response = await client.podman.listQuadlets(args);
			return { ...response, data: response.data.map((item) => ({ ...item, id: item.name })) };
		},
		debouncedSearch
	);
	const canDelete = can(Permission.Podman.quadletsDelete) && advanced;
	const canCreate = can(Permission.Podman.quadletsCreate) && advanced;
	const canRead = can(Permission.Podman.quadletsRead);

	useItemDeleteConfirmation(pendingDelete, setPendingDelete, (quadlet) => ({
		title: 'Remove Quadlet',
		message: `Remove “${quadlet.name}”? Its systemd unit is stopped and the file deleted.`,
		icon: 'trash',
		actions: [
			{
				title: 'Remove',
				action: () =>
					void removeQuadlet(environmentID, quadlet.name).then((removed) => {
						if (removed)
							paged.list.updateItems((items) =>
								items.filter((item) => item.value.name !== quadlet.name)
							);
					})
			}
		],
		dismissOnConfirm: false
	}));

	const menuActions = (quadlet: QuadletRow): PodmanMenuAction[] => {
		const actions: PodmanMenuAction[] = quadletActions(QuadletDetail.state(quadlet))
			.map((action) => quadletActionInfo[action])
			.filter((info) => can(info.permission))
			.map((info) => ({
				id: info.action,
				title: info.title,
				systemImage: info.systemImage,
				onPress: () => void runQuadletAction(environmentID, quadlet.name, info.action)
			}));
		if (canDelete)
			actions.push({
				id: 'remove',
				title: 'Remove',
				systemImage: 'trash',
				destructive: true,
				onPress: () => setPendingDelete(quadlet)
			});
		return actions;
	};

	return {
		...paged,
		environmentID,
		setSearchText,
		emptyTitle: debouncedSearch === '' ? 'No Quadlets' : 'No Results',
		canCreate,
		canDelete,
		menuActions,
		openDetail: (quadlet: QuadletRow) => {
			if (canRead) podman.openQuadlet(environmentID, quadlet);
		},
		openCreate: () => podman.openQuadletEditor(environmentID),
		requestDelete: (quadlet: QuadletRow) => setPendingDelete(quadlet)
	};
}

export type PodmanQuadletsModel = ReturnType<typeof usePodmanQuadlets>;

async function fetchQuadlet(environmentID: EnvironmentID, name: string) {
	const client = useClientManager.getState().client;
	if (!client) return undefined;
	const [detail, file] = await Promise.all([
		client.podman.quadlet({ name, envID: environmentID }),
		client.podman.quadletFile({ name, envID: environmentID }).catch(() => undefined)
	]);
	return { detail, content: file?.content };
}

export function usePodmanQuadletDetail() {
	const { name = '', envID = '0' } = useLocalSearchParams<{ name?: string; envID?: string }>();
	const environmentID = envID;
	const podman = usePodmanNavigation();
	const can = usePodmanCan(environmentID);
	const [advanced] = useAdvancedFeatures();
	const client = useClientManager((s) => s.client);
	const [detail, setDetail] = useState<QuadletDetail | undefined>(() =>
		screenCache.get<QuadletDetail>(podmanKeys.quadlet(environmentID, name))
	);
	const [content, setContent] = useState<string>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const [runningAction, setRunningAction] = useState<string>();
	const [removed, setRemoved] = useState(false);
	const loading = useRef(false);

	const load = useCallback(async () => {
		if (loading.current) return;
		loading.current = true;
		await withCleanup(
			async () => {
				try {
					const fetched = await fetchQuadlet(environmentID, name);
					if (!fetched) return;
					setDetail(fetched.detail);
					setContent(fetched.content);
					setErrorMessage(undefined);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				loading.current = false;
			}
		);
	}, [environmentID, name]);

	useEffect(() => {
		void load();
	}, [load, client]);
	useOnChange(usePodmanVersion(environmentID), () => {
		if (!removed) void load();
	});

	const perform = async (id: string, body: () => Promise<boolean>) => {
		setRunningAction(id);
		await withCleanup(
			async () => {
				await body();
			},
			() => setRunningAction(undefined)
		);
	};

	const state = detail ? QuadletDetail.state(detail) : '';
	const lifecycle: ActionButtonItem[] = detail
		? quadletActions(state)
				.map((action) => quadletActionInfo[action])
				.filter((info) => can(info.permission))
				.map((info) => ({
					id: info.action,
					title: info.title,
					systemImage: info.systemImage,
					tint: systemColors.blue,
					action: () =>
						void perform(info.action, () => runQuadletAction(environmentID, name, info.action))
				}))
		: [];

	const overflow: ActionButtonItem[] = [];
	if (detail && content !== undefined && advanced && can(Permission.Podman.quadletsUpdate))
		overflow.push({
			id: 'edit',
			title: 'Edit',
			systemImage: 'pencil',
			tint: systemColors.blue,
			action: () => podman.openQuadletEditor(environmentID, { name, content })
		});
	if (detail && advanced && can(Permission.Podman.quadletsDelete))
		overflow.push({
			id: 'remove',
			title: 'Remove',
			systemImage: 'trash',
			tint: systemColors.red,
			role: 'destructive',
			confirmationMessage: 'Its systemd unit is stopped and the file deleted.',
			dismissOnConfirm: false,
			action: () =>
				void perform('remove', async () => {
					const ok = await removeQuadlet(environmentID, name);
					if (ok) {
						setRemoved(true);
						podman.nav.back();
					}
					return ok;
				})
		});

	const [primary, ...secondary] = lifecycle;

	const details: { title: string; value: string; monospaced?: boolean }[] = [];
	if (detail) {
		details.push({ title: 'Type', value: podmanStateLabel(detail.type) });
		if (detail.unitName) details.push({ title: 'Unit', value: detail.unitName, monospaced: true });
		if (detail.app) details.push({ title: 'Application', value: detail.app });
		if (detail.template) details.push({ title: 'Template', value: 'Yes' });
		if (detail.path) details.push({ title: 'Path', value: detail.path, monospaced: true });
	}
	const unit = detail?.unitStatus;
	const unitDetails: { title: string; value: string }[] = unit
		? [
				{ title: 'Load', value: unit.loadState || '—' },
				{ title: 'Active', value: unit.activeState || '—' },
				{ title: 'Sub-State', value: unit.subState || '—' },
				...(unit.description ? [{ title: 'Description', value: unit.description }] : [])
			]
		: [];

	return {
		environmentID,
		name,
		detail,
		state,
		content,
		errorMessage,
		load,
		details,
		unitDetails,
		containers: detail?.containers ?? [],
		toolbar: {
			primary,
			secondary,
			overflow,
			runningItemID: runningAction,
			isDisabled: runningAction !== undefined
		}
	};
}

export type PodmanQuadletDetailModel = ReturnType<typeof usePodmanQuadletDetail>;

export const quadletTemplate = `[Unit]
Description=My container

[Container]
Image=docker.io/library/nginx:latest
PublishPort=8080:80

[Install]
WantedBy=default.target
`;

async function saveQuadlet(
	environmentID: EnvironmentID,
	existingName: string | undefined,
	name: string,
	content: string
): Promise<{ saved: boolean; failure?: string }> {
	const client = useClientManager.getState().client;
	if (!client) return { saved: false };
	const isEditing = existingName !== undefined && existingName !== '';
	const report = isEditing
		? await client.podman.updateQuadlet({
				name: existingName,
				request: { content },
				envID: environmentID
			})
		: await client.podman.installQuadlet({ request: { name, content }, envID: environmentID });
	podmanChanged(environmentID);
	const failure = QuadletInstallReport.firstError(report);
	if (failure !== undefined) return { saved: false, failure };
	showToast(Toasts.success(isEditing ? 'Quadlet saved' : 'Quadlet installed'));
	return { saved: true };
}

export function usePodmanQuadletEditor() {
	const router = useRouter();
	const { envID = '0', name: existingName } = useLocalSearchParams<{
		envID?: string;
		name?: string;
	}>();
	const environmentID = envID;
	const isEditing = existingName !== undefined && existingName !== '';
	const [original] = useState(() =>
		isEditing
			? (screenCache.get<string>(podmanKeys.quadletContent(environmentID, existingName)) ?? '')
			: ''
	);
	const [name, setName] = useState(isEditing ? existingName : '');
	const [content, setContent] = useState(() => (isEditing ? original : quadletTemplate));
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const trimmedName = name.trim();
	const nameError = isEditing ? undefined : quadletFileNameError(trimmedName);
	const hasChanges = isEditing
		? content !== original
		: trimmedName !== '' || content !== quadletTemplate;

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const save = async () => {
		setIsSaving(true);
		setErrorMessage(undefined);
		await withCleanup(
			async () => {
				try {
					const outcome = await saveQuadlet(environmentID, existingName, trimmedName, content);
					if (outcome.failure !== undefined) setErrorMessage(outcome.failure);
					else if (outcome.saved) dismiss();
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsSaving(false)
		);
	};

	return {
		isEditing,
		title: isEditing ? existingName : 'Install Quadlet',
		saveTitle: isEditing ? 'Save' : 'Install',
		name,
		setName,
		nameError,
		content,
		setContent,
		isSaving,
		errorMessage,
		hasChanges,
		canSave:
			!isSaving &&
			content.trim() !== '' &&
			(isEditing ? content !== original : trimmedName !== '' && nameError === undefined),
		cancel: dismiss,
		save: () => void save()
	};
}

export type PodmanQuadletEditorModel = ReturnType<typeof usePodmanQuadletEditor>;
