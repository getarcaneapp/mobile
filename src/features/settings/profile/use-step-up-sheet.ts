import { useState } from 'react';

import { withCleanup } from '@/core/with-cleanup';

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
		await withCleanup(
			async () => {
				setErrorMessage(await work());
			},
			() => setIsLoading(false)
		);
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
