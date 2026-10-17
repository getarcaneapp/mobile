import { useEffect } from 'react';

import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentColorStore } from '@/stores/environment-color-store';
import { environmentDisplayName, useEnvironmentsStore } from '@/stores/environments-store';
import { AccentColorOptions } from '@/theme/accent';
import { showToast, Toasts } from '@/ui/toast';

const blueHex = AccentColorOptions[0].hex;

export function useEnvironmentColors() {
	const environments = useEnvironmentsStore((s) => s.environments);
	const isLoading = useEnvironmentsStore((s) => s.isLoading);
	const errorMessage = useEnvironmentsStore((s) => s.errorMessage);
	const serverURL = useClientManager((s) => s.serverURL);

	useEffect(() => {
		void useEnvironmentsStore.getState().load();
	}, []);

	const sorted = [...environments].sort((a, b) =>
		environmentDisplayName(a).localeCompare(environmentDisplayName(b), undefined, {
			numeric: true,
			sensitivity: 'base'
		})
	);

	return {
		environments: sorted,
		errorMessage,
		showsLoading: isLoading && environments.length === 0,
		retry: () => void useEnvironmentsStore.getState().load({ refresh: true }),
		reset: (environment: Environment) =>
			useEnvironmentColorStore.getState().set(undefined, serverURL, environment.id)
	};
}

export function useEnvironmentColor(environment: Environment) {
	const serverURL = useClientManager((s) => s.serverURL);
	const storedHex = useEnvironmentColorStore((s) => s.hex(serverURL, environment.id));
	const selectedHex = storedHex ?? blueHex;

	const save = (hex: string) => {
		if (!useEnvironmentColorStore.getState().set(hex, serverURL, environment.id)) {
			showToast(
				Toasts.info('That color is already used by another environment. Choose a different color.')
			);
		}
	};

	return {
		name: environmentDisplayName(environment),
		selectedHex,
		save,
		isAvailable: (hex: string) =>
			useEnvironmentColorStore.getState().isAvailable(hex, serverURL, environment.id)
	};
}

export const EnvironmentColorsCopy = {
	footer:
		'Colors apply to environment names and icons in resource lists. Swipe a row to reset its color.',
	androidFooter:
		'Colors apply to environment names and icons in resource lists. Touch and hold a row to reset its color.'
} as const;
