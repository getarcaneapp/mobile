import * as Clipboard from 'expo-clipboard';
import { useEffect, useState, useSyncExternalStore } from 'react';

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
import { pluralCount } from '@/core/plural';

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

export function useLogStore(make: () => LogViewerStore, storeToken?: string) {
	const [store] = useState(() => routePayloads.get<LogViewerStore>(storeToken) ?? make());
	return store;
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
		statusLabel: logStatusLabel(snapshot.connectionState.kind, snapshot.isFollowing),
		countLabel: pluralCount(snapshot.lines.length, 'line')
	};
}

export type LogViewerModel = ReturnType<typeof useLogViewer>;

export function logStatusLabel(kind: string, isFollowing: boolean) {
	switch (kind) {
		case 'idle':
			return 'Disconnected';
		case 'connecting':
			return 'Connecting';
		case 'live':
			return isFollowing ? 'Live' : 'Paused';
		case 'ended':
			return 'Stream ended';
		default:
			return 'Connection failed';
	}
}
