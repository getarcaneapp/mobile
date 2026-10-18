import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { EnvironmentID } from '@/sdk/client/environment';
import { ContainerDetails } from '@/sdk/models/container/ContainerDetails';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { boundedContainerInspect } from './container-inspect';
import { useDebounced } from './hooks';

export function prettySortedJSON(value: unknown): string {
	const sort = (input: unknown): unknown => {
		if (Array.isArray(input)) return input.map(sort);
		if (input && typeof input === 'object') {
			return Object.fromEntries(
				Object.keys(input as object)
					.sort()
					.filter((key) => (input as Record<string, unknown>)[key] !== undefined)
					.map((key) => [key, sort((input as Record<string, unknown>)[key])])
			);
		}
		return input;
	};
	return JSON.stringify(sort(value), null, 2).replace(/^(\s*"(?:[^"\\]|\\.)*"): /gm, '$1 : ');
}

export function useContainerInspect(environmentID: EnvironmentID, containerID: string) {
	const [rawJSON, setRawJSON] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [searchText, setSearchText] = useState('');
	const query = useDebounced(searchText.trim(), 200);

	const load = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsLoading(true);
		await withCleanup(
			async () => {
				try {
					const details = await boundedContainerInspect(client, environmentID, containerID);
					setRawJSON(prettySortedJSON(ContainerDetails.encode(details)));
					setErrorMessage(undefined);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
	}, [environmentID, containerID]);

	useEffect(() => {
		void load();
	}, [load]);

	const lines = useMemo(() => rawJSON.split('\n'), [rawJSON]);
	const displayedJSON = useMemo(() => {
		const trimmed = searchText.trim();
		if (trimmed === '') return rawJSON;
		const needle = query.toLowerCase();
		return lines.filter((line) => line.toLowerCase().includes(needle)).join('\n');
	}, [rawJSON, lines, query, searchText]);

	return {
		rawJSON,
		displayedJSON,
		isLoading,
		errorMessage,
		searchText,
		setSearchText,
		load,
		copy: async () => {
			await Clipboard.setStringAsync(rawJSON);
			showToast(Toasts.copied('Inspect JSON copied'));
		}
	};
}
