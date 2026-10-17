/**
 * Shared logic for `AccountPreferencesView`
 * (Views/Settings/AccountPreferencesView.swift): server-stored account
 * preferences that change what the app shows.
 */
import { useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { ResponseCache } from '@/core/networking/response-cache';
import { User, type UserPreferences } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

export type IconCatalog = 'selfhst' | 'dashboard-icons';

export const iconCatalogs: { value: IconCatalog; title: string }[] = [
	{ value: 'selfhst', title: 'selfh.st' },
	{ value: 'dashboard-icons', title: 'Dashboard Icons' }
];

function iconCatalog(raw: string | undefined): IconCatalog {
	return iconCatalogs.find((catalog) => catalog.value === raw)?.value ?? 'selfhst';
}

export function useAccountPreferences() {
	const user = useClientManager((s) => s.currentUser);
	const [isSaving, setIsSaving] = useState(false);
	const savingRef = useRef(false);

	/** Sends only the changed preference; the server keeps the rest. */
	const save = async (preferences: UserPreferences) => {
		const client = useClientManager.getState().client;
		if (!client || savingRef.current) return;
		savingRef.current = true;
		setIsSaving(true);
		try {
			const updated = await client.rest.put('auth/me/profile', {
				body: { preferences },
				decode: User.decode
			});
			useClientManager.setState({ currentUser: updated });
			// Icons are resolved into cached list responses; drop them so lists
			// pick up the new catalog on their next load.
			ResponseCache.invalidateAll();
			showToast(Toasts.success('Preferences saved'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		} finally {
			savingRef.current = false;
			setIsSaving(false);
		}
	};

	return {
		isSaving,
		iconCatalog: iconCatalog(user?.preferences?.iconCatalog),
		setIconCatalog: (catalog: IconCatalog) => void save({ iconCatalog: catalog })
	};
}
