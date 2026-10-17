/**
 * Data for the embedded image detail tabs: `ImageHistoryView` and
 * `ImageAttestationsView` (+ `ImageAttestationDetailView`'s statement load).
 */
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ImageAttestation, ImageAttestationList } from '@/sdk/models/image/ImageAttestation';
import type { ImageHistoryItem } from '@/sdk/models/image/ImageHistory';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { prettySortedJSON } from './image-model';

// MARK: - ImageHistoryView

export const layerID = (id: string) => (id === '<missing>' ? 'Metadata-only layer' : id);

/** `Text(Date(timeIntervalSince1970:), format: .dateTime.year().month().day())`. */
export const historyDate = (created: number) =>
	new Date(created * 1000).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});

export function useImageHistory(environmentID: EnvironmentID, imageID: string) {
	const [items, setItems] = useState<ImageHistoryItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const loading = useRef(false);

	const load = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client || loading.current) return;
		loading.current = true;
		setIsLoading(true);
		try {
			setItems(await client.images.history({ envID: environmentID, imageID }));
			setErrorMessage(undefined);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			loading.current = false;
			setIsLoading(false);
		}
	}, [environmentID, imageID]);

	useEffect(() => {
		void load();
	}, [load]);

	return { items, isLoading, errorMessage, load };
}

// MARK: - ImageAttestationsView

/** `active` mirrors the embedded view's `.task`: it loads each time its tab appears. */
export function useImageAttestations(
	environmentID: EnvironmentID,
	imageID: string,
	active: boolean
) {
	const [result, setResult] = useState<ImageAttestationList>();
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [selectedPredicateType, setSelectedPredicateType] = useState<string>();

	const load = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsLoading(true);
		try {
			setResult(await client.images.attestations({ envID: environmentID, id: imageID }));
			setErrorMessage(undefined);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	}, [environmentID, imageID]);

	useEffect(() => {
		if (active) void load();
	}, [active, load]);

	const all = result?.attestations ?? [];
	const attestations =
		selectedPredicateType === undefined
			? all
			: all.filter((a) => a.predicateType === selectedPredicateType);
	const predicateTypes = [...new Set(all.map((a) => a.predicateType))].sort();

	return {
		result,
		isLoading,
		errorMessage,
		load,
		attestations,
		predicateTypes,
		selectedPredicateType,
		setSelectedPredicateType
	};
}

export type ImageAttestationsModel = ReturnType<typeof useImageAttestations>;

// MARK: - ImageAttestationDetailView

export function useAttestationStatement(
	environmentID: EnvironmentID,
	imageID: string,
	attestation: ImageAttestation | undefined
) {
	const [statementJSON, setStatementJSON] = useState<string>();
	const [isLoadingStatement, setIsLoadingStatement] = useState(false);
	const [statementError, setStatementError] = useState<string>();

	const loadStatement = async () => {
		const client = useClientManager.getState().client;
		if (!client || !attestation) return;
		setIsLoadingStatement(true);
		try {
			const list = await client.images.attestations({
				envID: environmentID,
				id: imageID,
				platform: attestation.platform,
				predicateType: attestation.predicateType,
				includeStatement: true
			});
			const statement = list.attestations.find((a) => a.digest === attestation.digest)?.statement;
			if (statement === undefined) {
				setStatementError('No statement payload returned.');
				return;
			}
			setStatementJSON(prettySortedJSON(statement));
			setStatementError(undefined);
		} catch (error) {
			setStatementError(friendlyErrorMessage(error));
		} finally {
			setIsLoadingStatement(false);
		}
	};

	const copyStatement = () => {
		if (statementJSON === undefined) return;
		void Clipboard.setStringAsync(statementJSON);
		showToast(Toasts.copied('Statement copied'));
	};

	return {
		statementJSON,
		isLoadingStatement,
		statementError,
		loadStatement: () => void loadStatement(),
		copyStatement
	};
}
