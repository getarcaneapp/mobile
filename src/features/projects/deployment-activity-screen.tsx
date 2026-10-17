/**
 * The root-level stream sheet of `DeploymentActivityStore` (Swift presents
 * `InstallStreamSheet` from the app root): the live log of the running
 * project operation. Hiding it keeps the operation running.
 */
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { useProjectDeploymentStore } from '@/stores/project-deployment-store';
import { consolePalette } from '@/ui/components/install-stream.types';
import { InstallStreamSheet } from '@/ui/components/install-stream-sheet';

export function DeploymentActivityScreen() {
	const router = useRouter();
	const operation = useProjectDeploymentStore((s) => s.operation);

	useEffect(() => {
		useProjectDeploymentStore.getState().setSheetPresented(true);
		return () => useProjectDeploymentStore.getState().setSheetPresented(false);
	}, []);

	const hide = () => {
		if (router.canGoBack()) router.back();
	};

	return (
		<View style={{ flex: 1, backgroundColor: consolePalette.background }}>
			<Stack.Screen
				options={{ title: operation?.title ?? '', headerShown: Platform.OS === 'android' }}
			/>
			{operation ? (
				<InstallStreamSheet
					operation={operation}
					onCancel={() => useProjectDeploymentStore.getState().cancel()}
					onDone={() => {
						useProjectDeploymentStore.getState().acknowledge();
						hide();
					}}
					onHide={hide}
				/>
			) : null}
		</View>
	);
}
