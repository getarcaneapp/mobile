/** Shared state for `AppIconPickerView` (AppIconPickerView.swift). */
import { useEffect, useState } from 'react';

import { showToast, Toasts } from '@/ui/toast';

import { AlternateAppIcons, useAppIconState, type AppIconOption } from './alternate-app-icons';

export function useAppIconPicker() {
	const { currentIconName } = useAppIconState();
	const [errorMessage, setErrorMessage] = useState<string | undefined>();

	// Swift reads `UIApplication.shared.alternateIconName` when the view appears.
	useEffect(() => {
		void AlternateAppIcons.refresh();
	}, []);

	const select = (option: AppIconOption) => {
		if (option.alternateName === currentIconName) return;
		AlternateAppIcons.setAlternateIconName(option.alternateName).then(
			() => showToast(Toasts.success('App icon changed')),
			(error: unknown) => setErrorMessage(error instanceof Error ? error.message : String(error))
		);
	};

	return {
		options: AlternateAppIcons.options,
		currentIconName,
		select,
		errorMessage,
		clearError: () => setErrorMessage(undefined)
		/** Android: launchers apply component changes on their own schedule. */
	};
}
