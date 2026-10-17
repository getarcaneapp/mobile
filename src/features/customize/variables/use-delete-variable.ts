/** The platform-neutral model behind `DeleteVariableView` (VariablesView.swift). */
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { useSettingsNavigation } from '@/features/settings/shared/settings-routes';
import { showToast, Toasts } from '@/ui/toast';

import { useRoutePayload } from '../dynamic-resources/dynamic-resource-routes';
import type { DeleteVariablePayload } from './use-variables';

export function useDeleteVariable() {
	const nav = useSettingsNavigation();
	const payload = useRoutePayload<DeleteVariablePayload>();
	const [isDeleting, setIsDeleting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const remove = async () => {
		if (!payload) return;
		setIsDeleting(true);
		setErrorMessage(undefined);
		try {
			await payload.onDelete();
			showToast(Toasts.success('Variable deleted'));
			nav.back();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsDeleting(false);
		}
	};

	return {
		prompt: `Delete “${payload?.variable.key ?? ''}” and remove it from its environments?`,
		isDeleting,
		errorMessage,
		remove,
		cancel: nav.back
	};
}
