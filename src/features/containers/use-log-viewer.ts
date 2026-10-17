/**
 * `LogsView` state: the `LogViewerStore` (shared between the embedded console
 * and its full-screen expansion), the timestamp / wrap preferences, and the
 * Copy All / Share All actions.
 */
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { boundedContainerLogs } from '@/core/networking/bounded-streams';
import { useStoredBool } from '@/core/storage';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import {
	LogViewerFormatting,
	LogViewerPreferences,
	LogViewerStore
} from '@/stores/log-viewer-store';
import { showToast, Toasts } from '@/ui/toast';

import { routePayloads } from './container-routes';
import { shareTextFile } from './share-file';

/** `manager.client?.boundedContainerLogs(envID:id:timestamps: true)`. */
export function containerLogStore(environmentID: EnvironmentID, containerID: string) {
	return new LogViewerStore((signal) => {
		const client = useClientManager.getState().client;
		return client
			? boundedContainerLogs(
					client,
					{ envID: environmentID, id: containerID, timestamps: true },
					signal
				)
			: undefined;
	});
}

/** One store per mounted viewer, or the shared one handed over via `storeToken`. */
export function useLogStore(make: () => LogViewerStore, storeToken?: string) {
	const ref = useRef<LogViewerStore | null>(null);
	ref.current ??= routePayloads.get<LogViewerStore>(storeToken) ?? make();
	return ref.current;
}

const exportStamp = (date: Date) => {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

export function useLogViewer(
	store: LogViewerStore,
	title: string,
	lifecycle: 'owner' | 'borrowed'
) {
	const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
	const [showTimestamps, setShowTimestamps] = useStoredBool(
		LogViewerPreferences.showTimestampsKey,
		LogViewerPreferences.showsTimestampsByDefault
	);
	const [wrapLines, setWrapLines] = useStoredBool(
		LogViewerPreferences.wrapLinesKey,
		LogViewerPreferences.wrapsLinesByDefault
	);

	// `.onAppear { store.start() }` / `.onDisappear { store.stop() }`. A borrowed
	// (expanded) viewer starts the stream if needed but leaves stopping to the owner.
	useEffect(() => {
		store.start();
		if (lifecycle === 'owner') return () => store.stop();
	}, [store, lifecycle]);

	const copyLogs = async () => {
		const text = store.exportText(showTimestamps);
		if (text === '') return;
		await Clipboard.setStringAsync(text);
		showToast(Toasts.copied());
	};

	const shareLogs = async () => {
		const text = store.exportText(showTimestamps);
		if (text === '') return;
		try {
			await shareTextFile(
				`${LogViewerFormatting.sanitizedFilename(title)}-${exportStamp(new Date())}.log`,
				text
			);
		} catch {
			showToast(Toasts.error("Couldn't export logs"));
		}
	};

	const copyLine = async (text: string) => {
		await Clipboard.setStringAsync(text);
		showToast(Toasts.copied());
	};

	return {
		store,
		snapshot,
		showTimestamps,
		setShowTimestamps,
		wrapLines,
		setWrapLines,
		copyLogs: () => void copyLogs(),
		shareLogs: () => void shareLogs(),
		copyLine: (text: string) => void copyLine(text),
		statusLabel: logStatusLabel(
			snapshot.connectionState.kind,
			snapshot.isFollowing,
			snapshot.lines.length === 0
		),
		countLabel: `${snapshot.lines.length} lines`
	};
}

export type LogViewerModel = ReturnType<typeof useLogViewer>;

export function logStatusLabel(kind: string, isFollowing: boolean, isEmpty: boolean) {
	switch (kind) {
		case 'idle':
			return 'Disconnected';
		case 'connecting':
			return 'Connecting';
		case 'live':
			return !isFollowing ? 'Paused' : isEmpty ? 'Waiting for output' : 'Live';
		case 'ended':
			return 'Stream ended';
		default:
			return 'Connection failed';
	}
}
