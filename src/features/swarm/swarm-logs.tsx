/**
 * `LogsView` for a swarm service (`manager.client?.boundedSwarmServiceLogs`):
 * the embedded console in Service Detail (with Expand) and the full-screen
 * cover opened from the services list, sharing one `LogViewerStore`.
 *
 * Standalone (RN views; reuses the Containers log console).
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { boundedSwarmServiceLogs } from '@/core/networking/bounded-streams';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import { LogViewerStore } from '@/stores/log-viewer-store';
import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { LogConsole, type LogConsoleHandle } from '@/features/containers/log-console';
import {
	logOptionsMenuItems,
	logOptionsToolbarMenu
} from '@/features/containers/log-options-toolbar';
import { LogStatusBar } from '@/features/containers/log-status-bar';
import { useLogStore, useLogViewer } from '@/features/containers/use-log-viewer';
import { routePayloads, useTabRouter } from '@/features/networks/tab-routes';

function serviceLogStore(environmentID: EnvironmentID, serviceID: string) {
	return new LogViewerStore((signal) => {
		const client = useClientManager.getState().client;
		return client
			? boundedSwarmServiceLogs(
					client,
					{ envID: environmentID, serviceID, timestamps: true },
					signal
				)
			: undefined;
	});
}

export function EmbeddedServiceLogs({
	environmentID,
	serviceID,
	title
}: {
	environmentID: EnvironmentID;
	serviceID: string;
	title: string;
}) {
	const nav = useTabRouter();
	const store = useLogStore(() => serviceLogStore(environmentID, serviceID));
	const model = useLogViewer(store, title, 'owner');
	const consoleRef = useRef<LogConsoleHandle>(null);
	const [token] = useState(() => routePayloads.put(store));
	useEffect(() => () => routePayloads.delete(token), [token]);
	return (
		<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
			<LogStatusBar
				model={model}
				embedded
				onExpand={() =>
					nav.push(`swarm-service/${encodeURIComponent(serviceID)}/logs`, {
						envID: environmentID,
						title,
						store: token
					})
				}
				onJumpToLatest={() => consoleRef.current?.jumpToLatest()}
			/>
			<View style={{ height: 0.5, backgroundColor: colors.separator }} />
			<LogConsole ref={consoleRef} model={model} />
		</View>
	);
}

/** Full-screen viewer: Done + options in the navigation bar. */
export function SwarmServiceLogsScreen() {
	const router = useRouter();
	const accent = useAccentColor();
	const {
		id = '',
		envID = '0',
		title = '',
		store: storeToken
	} = useLocalSearchParams<{ id?: string; envID?: string; title?: string; store?: string }>();
	const store = useLogStore(() => serviceLogStore(envID, id), storeToken);
	const model = useLogViewer(store, title, storeToken ? 'borrowed' : 'owner');
	const consoleRef = useRef<LogConsoleHandle>(null);
	return (
		<>
			<Stack.Screen options={{ title }} />
			{Platform.OS === 'android' ? (
				<>
					<AndroidToolbar
						placement="left"
						items={[
							{
								kind: 'button',
								id: 'done',
								icon: 'xmark',
								label: 'Done',
								onPress: () => router.back()
							}
						]}
					/>
					<AndroidToolbar
						items={[
							{
								kind: 'menu',
								id: 'options',
								icon: 'ellipsis.circle',
								label: 'Log options',
								items: logOptionsMenuItems(model)
							}
						]}
					/>
				</>
			) : (
				<>
					<AppToolbar placement="left" tintColor={accent}>
						<Stack.Toolbar.Button onPress={() => router.back()}>Done</Stack.Toolbar.Button>
					</AppToolbar>
					<AppToolbar placement="right" tintColor={accent}>
						{logOptionsToolbarMenu(model)}
					</AppToolbar>
				</>
			)}
			<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
				<LogStatusBar
					model={model}
					embedded={false}
					onJumpToLatest={() => consoleRef.current?.jumpToLatest()}
				/>
				<View style={{ height: 0.5, backgroundColor: colors.separator }} />
				<LogConsole ref={consoleRef} model={model} />
			</View>
		</>
	);
}
