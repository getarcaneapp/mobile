import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { SwarmServiceInspect } from '@/sdk/models/swarm/SwarmServices';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { screenCache } from '@/features/networks/tab-routes';

import { swarmChanged, swarmVersionIndex } from './swarm-common';
import { swarmKeys } from './swarm-routes';
import {
	applyDraft,
	draftFromSpec,
	draftIsValid,
	draftsEqual,
	emptyDraft,
	newMount,
	newPair,
	newPort,
	type DraftMount,
	type DraftPair,
	type DraftPort,
	type SwarmServiceSpecDraft
} from './swarm-spec-draft';

export type PairsField = 'env' | 'labels';

export function useSwarmServiceEditor() {
	const router = useRouter();
	const { envID = '0', serviceID } = useLocalSearchParams<{ envID?: string; serviceID?: string }>();
	const [existing] = useState(() =>
		serviceID
			? screenCache.get<SwarmServiceInspect>(swarmKeys.inspect(envID, serviceID))
			: undefined
	);
	const [initialDraft] = useState(() => (existing ? draftFromSpec(existing.spec) : emptyDraft()));
	const [draft, setDraft] = useState<SwarmServiceSpecDraft>(initialDraft);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const isEditing = existing !== undefined;
	const hasChanges = !draftsEqual(draft, initialDraft);
	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};

	const update = (patch: Partial<SwarmServiceSpecDraft>) =>
		setDraft((current) => ({ ...current, ...patch }));
	const updatePort = (id: string, patch: Partial<DraftPort>) =>
		setDraft((current) => ({
			...current,
			ports: current.ports.map((p) => (p.id === id ? { ...p, ...patch } : p))
		}));
	const updateMount = (id: string, patch: Partial<DraftMount>) =>
		setDraft((current) => ({
			...current,
			mounts: current.mounts.map((m) => (m.id === id ? { ...m, ...patch } : m))
		}));
	const updatePair = (field: PairsField, id: string, patch: Partial<DraftPair>) =>
		setDraft((current) => ({
			...current,
			[field]: current[field].map((p) => (p.id === id ? { ...p, ...patch } : p))
		}));
	const removeAt = <K extends 'ports' | 'mounts' | 'env' | 'labels'>(field: K, indices: number[]) =>
		setDraft((current) => ({
			...current,
			[field]: (current[field] as unknown[]).filter((_, index) => !indices.includes(index))
		}));

	const save = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			const spec = applyDraft(draft, existing?.spec);
			let warnings: string[] | undefined;
			if (existing) {
				const response = await client.swarm.updateService({
					serviceId: existing.id,
					request: { version: swarmVersionIndex(existing.version) ?? 0, spec },
					envID
				});
				warnings = response.warnings;
			} else {
				const response = await client.swarm.createService({ request: { spec }, envID });
				warnings = response.warnings;
			}
			swarmChanged(envID);
			showToast(Toasts.success(isEditing ? 'Service updated' : 'Service created'));
			const warning = warnings?.[0];
			if (warning) showToast(Toasts.info(warning));
			dismiss();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	return {
		draft,
		update,
		updatePort,
		updateMount,
		updatePair,
		addPort: () => update({ ports: [...draft.ports, newPort()] }),
		addMount: () => update({ mounts: [...draft.mounts, newMount()] }),
		addPair: (field: PairsField) => update({ [field]: [...draft[field], newPair()] }),
		removeAt,
		isEditing,
		hasChanges,
		isSaving,
		errorMessage,
		canSave: !isSaving && draftIsValid(draft) && (!isEditing || hasChanges),
		title: isEditing ? 'Edit Service' : 'Create Service',
		saveTitle: isEditing ? 'Save' : 'Create',
		cancel: dismiss,
		save: () => void save()
	};
}

export type SwarmServiceEditorModel = ReturnType<typeof useSwarmServiceEditor>;
