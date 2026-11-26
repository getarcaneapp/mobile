import { File } from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { pickedFileName } from '@/core/picked-file-name';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { BrandImageSlot } from '@/sdk/models/settings/BrandImage';
import type { PublicSetting } from '@/sdk/models/settings/Settings';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import {
	brandHashes,
	brandImageContentType,
	brandImageError,
	brandPreviewURL,
	brandSlots,
	developmentBrandingEnabled,
	emptyBrandHashes,
	isDevelopmentBuild,
	type BrandHashes,
	type BrandSlotDef
} from './branding-model';

type BrandingSnapshot = {
	hashes: BrandHashes;
	developmentBranding: boolean;
	developmentBrandingLocked: boolean;
	isReadOnly: boolean;
	isDevelopmentBuild: boolean;
};

const emptySnapshot: BrandingSnapshot = {
	hashes: emptyBrandHashes,
	developmentBranding: true,
	developmentBrandingLocked: false,
	isReadOnly: false,
	isDevelopmentBuild: false
};

export type BrandPending = { slot: BrandImageSlot; action: 'upload' | 'remove' };

export type BrandSlotState = BrandSlotDef & {
	isCustom: boolean;
	previewURL: string | undefined;
};

function snapshotFrom(settings: PublicSetting[], developmentBuild: boolean): BrandingSnapshot {
	const development = settings.find((setting) => setting.key === 'developmentBrandingEnabled');
	return {
		hashes: brandHashes(settings),
		developmentBranding: developmentBrandingEnabled(settings),
		developmentBrandingLocked: development?.locked === true,
		isReadOnly: settings.some((setting) => setting.lockReason === 'readOnly'),
		isDevelopmentBuild: developmentBuild
	};
}

async function fetchBranding(client: ArcaneClient): Promise<BrandingSnapshot> {
	const [settings, version] = await Promise.all([
		client.settings.getPublicSettings(),
		client.version.appVersion().catch(() => undefined)
	]);
	return snapshotFrom(settings, isDevelopmentBuild(version));
}

async function pickBrandFile(def: BrandSlotDef) {
	const result = await File.pickFileAsync({ mimeTypes: def.mimeTypes });
	if (result.canceled) return undefined;
	const file = result.result;
	return { uri: file.uri, name: pickedFileName(file), type: file.type, size: file.size };
}

type ActionResult = { kind: 'done' } | { kind: 'skipped' } | { kind: 'failed'; message: string };

async function uploadBrandFile(client: ArcaneClient, def: BrandSlotDef): Promise<ActionResult> {
	try {
		const picked = await pickBrandFile(def);
		if (!picked) return { kind: 'skipped' };
		const error = brandImageError(def, picked);
		if (error) return { kind: 'failed', message: error };
		await client.settings.uploadBrandImage({
			slot: def.slot,
			fileURL: picked.uri,
			filename: picked.name,
			contentType: brandImageContentType(def, picked)
		});
		return { kind: 'done' };
	} catch (error) {
		if (isCancellation(error)) return { kind: 'skipped' };
		return { kind: 'failed', message: friendlyErrorMessage(error) };
	}
}

async function removeBrandFile(client: ArcaneClient, def: BrandSlotDef): Promise<ActionResult> {
	try {
		await client.settings.deleteBrandImage({ slot: def.slot });
		return { kind: 'done' };
	} catch (error) {
		return { kind: 'failed', message: friendlyErrorMessage(error) };
	}
}

async function saveDevelopmentBranding(
	client: ArcaneClient,
	enabled: boolean
): Promise<ActionResult> {
	try {
		await client.settings.updateGlobalSettings({
			scope: 'manager',
			body: { developmentBrandingEnabled: String(enabled) }
		});
		return { kind: 'done' };
	} catch (error) {
		return { kind: 'failed', message: friendlyErrorMessage(error) };
	}
}

async function loadBranding(
	client: ArcaneClient
): Promise<{ snapshot: BrandingSnapshot } | { message: string }> {
	try {
		return { snapshot: await fetchBranding(client) };
	} catch (error) {
		return { message: friendlyErrorMessage(error) };
	}
}

export function useBrandingSettings() {
	const client = useClientManager((s) => s.client);
	const serverURL = useClientManager((s) => s.serverURL);
	const clientGeneration = useClientManager((s) => s.clientGeneration);
	const [snapshot, setSnapshot] = useState<BrandingSnapshot>(emptySnapshot);
	const [hasLoaded, setHasLoaded] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | undefined>();
	const [pending, setPending] = useState<BrandPending | undefined>();
	const [isSavingDevelopment, setIsSavingDevelopment] = useState(false);

	const load = useCallback(async () => {
		if (!client) return;
		setIsLoading(true);
		const result = await loadBranding(client);
		if ('snapshot' in result) {
			setSnapshot(result.snapshot);
			setHasLoaded(true);
			setErrorMessage(undefined);
		} else {
			setErrorMessage(result.message);
		}
		setIsLoading(false);
	}, [client]);

	useEffect(() => {
		void load();
	}, [load, clientGeneration]);

	const usesDevelopmentBranding = snapshot.isDevelopmentBuild && snapshot.developmentBranding;
	const slots: BrandSlotState[] = brandSlots.map((def) => ({
		...def,
		isCustom: snapshot.hashes[def.slot] !== '',
		previewURL: brandPreviewURL(
			serverURL,
			def.slot,
			snapshot.hashes[def.slot],
			usesDevelopmentBranding
		)
	}));

	const finish = async (result: ActionResult, success: string) => {
		if (result.kind === 'failed') showToast(Toasts.error(result.message));
		if (result.kind === 'done') {
			showToast(Toasts.success(success));
			await load();
		}
		setPending(undefined);
	};

	const upload = async (def: BrandSlotDef) => {
		if (!client || pending) return;
		setPending({ slot: def.slot, action: 'upload' });
		await finish(await uploadBrandFile(client, def), `${def.title} updated`);
	};

	const remove = async (def: BrandSlotDef) => {
		if (!client || pending) return;
		setPending({ slot: def.slot, action: 'remove' });
		await finish(await removeBrandFile(client, def), `${def.title} removed`);
	};

	const setDevelopmentBranding = async (enabled: boolean) => {
		if (!client || isSavingDevelopment) return;
		const previous = snapshot.developmentBranding;
		setIsSavingDevelopment(true);
		setSnapshot((current) => ({ ...current, developmentBranding: enabled }));
		const result = await saveDevelopmentBranding(client, enabled);
		if (result.kind === 'failed') {
			setSnapshot((current) => ({ ...current, developmentBranding: previous }));
			showToast(Toasts.error(result.message));
		} else {
			showToast(Toasts.success('Settings saved'));
		}
		setIsSavingDevelopment(false);
	};

	return {
		slots,
		hasLoaded,
		isLoading,
		errorMessage,
		pending,
		isReadOnly: snapshot.isReadOnly,
		showsDevelopmentBranding: snapshot.isDevelopmentBuild,
		developmentBranding: snapshot.developmentBranding,
		developmentBrandingLocked: snapshot.developmentBrandingLocked,
		isSavingDevelopment,
		load,
		upload: (def: BrandSlotDef) => void upload(def),
		remove: (def: BrandSlotDef) => void remove(def),
		setDevelopmentBranding: (enabled: boolean) => void setDevelopmentBranding(enabled)
	};
}
