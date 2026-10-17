/** Sheet-local state for `StepUpAuthenticationSheet` (PasskeysMFAView.swift). */
import { useState } from 'react';

import type { StepUpSheetProps } from './step-up-sheet.types';

export function useStepUpSheet({
	authenticateWithPassword,
	authenticateWithPasskey
}: StepUpSheetProps) {
	const [password, setPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();

	const run = async (work: () => Promise<string | undefined>) => {
		setIsLoading(true);
		setErrorMessage(undefined);
		try {
			setErrorMessage(await work());
		} finally {
			setIsLoading(false);
		}
	};

	return {
		password,
		setPassword,
		isLoading,
		errorMessage,
		passwordDisabled: password === '' || isLoading,
		submitPassword: () => void run(() => authenticateWithPassword(password)),
		submitPasskey: () => void run(authenticateWithPasskey)
	};
}
