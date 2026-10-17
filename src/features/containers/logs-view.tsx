import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import type { EnvironmentID } from '@/sdk/client/environment';
import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { AndroidToolbar } from './android-toolbar';

import { routePayloads } from './container-routes';
import { LogConsole, type LogConsoleHandle } from './log-console';
import { logOptionsMenuItems, logOptionsToolbarMenu } from './log-options-toolbar';
import { LogStatusBar } from './log-status-bar';
import { containerLogStore, useLogStore, useLogViewer } from './use-log-viewer';

export function EmbeddedContainerLogs({
	environmentID,
	containerID,
	title,
	onExpand
}: {
	environmentID: EnvironmentID;
	containerID: string;
	title: string;
	onExpand: (storeToken: string) => void;
}) {
	const store = useLogStore(() => containerLogStore(environmentID, containerID));
	const model = useLogViewer(store, title, 'owner');
	const consoleRef = useRef<LogConsoleHandle>(null);
	const [token] = useState(() => routePayloads.put(store));
	useEffect(() => () => routePayloads.delete(token), [token]);

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
			<LogStatusBar
				model={model}
				embedded
				onExpand={() => onExpand(token)}
				onJumpToLatest={() => consoleRef.current?.jumpToLatest()}
			/>
			<View style={{ height: 0.5, backgroundColor: colors.separator }} />
			<LogConsole ref={consoleRef} model={model} />
		</View>
	);
}

export function ContainerLogsScreen() {
	const router = useRouter();
	const accent = useAccentColor();
	const {
		id = '',
		envID = '0',
		title = '',
		store: storeToken
	} = useLocalSearchParams<{ id?: string; envID?: string; title?: string; store?: string }>();
	const store = useLogStore(() => containerLogStore(envID, id), storeToken);
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
