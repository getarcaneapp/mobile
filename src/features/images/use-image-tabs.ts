import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ImageAttestation, ImageAttestationList } from '@/sdk/models/image/ImageAttestation';
import type { ImageHistoryItem } from '@/sdk/models/image/ImageHistory';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { prettySortedJSON } from './image-model';

const historyDateFormat = new Intl.DateTimeFormat(undefined, {
	year: 'numeric',
	month: 'short',
	day: 'numeric'
});

export const historyDate = (created: number) => historyDateFormat.format(new Date(created * 1000));

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
		await withCleanup(
			async () => {
				try {
					setItems(await client.images.history({ envID: environmentID, imageID }));
					setErrorMessage(undefined);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => {
				loading.current = false;
				setIsLoading(false);
			}
		);
	}, [environmentID, imageID]);

	useEffect(() => {
		void load();
	}, [load]);

	return { items, isLoading, errorMessage, load };
}

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
		await withCleanup(
			async () => {
				try {
					setResult(await client.images.attestations({ envID: environmentID, id: imageID }));
					setErrorMessage(undefined);
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsLoading(false)
		);
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

async function loadAttestationStatement({
	client,
	environmentID,
	imageID,
	attestation,
	setStatementJSON,
	setStatementError
}: {
	client: ArcaneClient;
	environmentID: EnvironmentID;
	imageID: string;
	attestation: ImageAttestation;
	setStatementJSON: (json: string) => void;
	setStatementError: (error: string | undefined) => void;
}) {
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
	}
}

const statementPreviewLineLimit = 400;
const statementChunkLines = 40;

export function statementPreviewChunks(json: string) {
	const lines = json.split('\n');
	const shown = lines.slice(0, statementPreviewLineLimit);
	const chunks: string[] = [];
	for (let start = 0; start < shown.length; start += statementChunkLines) {
		chunks.push(shown.slice(start, start + statementChunkLines).join('\n'));
	}
	return {
		chunks,
		totalLines: lines.length,
		isTruncated: lines.length > shown.length,
		shownLines: shown.length
	};
}

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
		await withCleanup(
			() =>
				loadAttestationStatement({
					client,
					environmentID,
					imageID,
					attestation,
					setStatementJSON,
					setStatementError
				}),
			() => setIsLoadingStatement(false)
		);
	};

	const copyStatement = () => {
		if (statementJSON === undefined) return;
		void Clipboard.setStringAsync(statementJSON);
		showToast(Toasts.copied('Statement copied'));
	};

	const statementPreview = useMemo(
		() => (statementJSON === undefined ? undefined : statementPreviewChunks(statementJSON)),
		[statementJSON]
	);

	return {
		statementJSON,
		statementPreview,
		isLoadingStatement,
		statementError,
		loadStatement: () => void loadStatement(),
		copyStatement
	};
}
