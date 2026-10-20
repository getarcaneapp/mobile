import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { Keys, useStoredString } from '@/core/storage';
import { startWidgetPublisher } from '@/core/widgets/widget-publisher';
import { useClientManager } from '@/stores/client-manager';
import { useLaunchSplash } from '@/stores/launch-splash-store';
import { usePushNotificationCoordinator } from '@/stores/push-notification-coordinator';
import { useAccentColor } from '@/theme/accent';
import { useAppearanceRemountKey } from '@/theme/use-appearance-remount';
import { ArcaneLaunchSplash } from '@/ui/components/arcane-launch-splash';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { ToastHost } from '@/ui/toast';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const scheme = useColorScheme();
	const accent = useAccentColor();
	const [accentColorHex] = useStoredString(Keys.accentColorHex, '');
	const authState = useClientManager((s) => s.authState);
	const showsLaunchSplash = useLaunchSplash((s) => s.isPresented);
	const dismissLaunchSplash = useLaunchSplash((s) => s.dismiss);
	const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
	const appearanceKey = useAppearanceRemountKey();

	useEffect(() => {
		void useClientManager.getState().checkExistingAuth();
	}, []);

	useEffect(() => usePushNotificationCoordinator.getState().observeDeviceToken(), []);

	useEffect(() => startWidgetPublisher(), []);

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) => {
			if (state === 'active') void useClientManager.getState().retryConnectionBootstrapIfNeeded();
		});
		return () => subscription.remove();
	}, []);

	useEffect(() => {
		if (showsLaunchSplash || authState !== 'authenticating') void SplashScreen.hideAsync();
	}, [authState, showsLaunchSplash]);

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<KeyboardProvider>
				<ThemeProvider
					key={appearanceKey}
					value={{ ...base, colors: { ...base.colors, primary: accent } }}
				>
					<Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
						<Stack.Screen name="index" />
						<Stack.Protected guard={authState === 'authenticated'}>
							<Stack.Screen name="(tabs)" />
						</Stack.Protected>
						<Stack.Protected guard={authState !== 'authenticated'}>
							<Stack.Screen name="login" />
						</Stack.Protected>
						<Stack.Screen
							name="connection-profiles"
							options={{
								presentation: 'formSheet',
								sheetAllowedDetents: [0.5, 1],
								sheetGrabberVisible: true,
								animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom'
							}}
						/>
						<Stack.Screen
							name="connection-profile-editor"
							options={{
								presentation: 'formSheet',
								sheetAllowedDetents: [0.5, 1],
								sheetGrabberVisible: true,
								animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom'
							}}
						/>
						<Stack.Screen
							name="whats-new"
							options={{
								presentation: 'formSheet',
								sheetAllowedDetents: [1],
								sheetGrabberVisible: false,
								animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom'
							}}
						/>
					</Stack>
					<StatusBar style="auto" />
					<DeleteConfirmationHost />
					<ToastHost reservesTabBarSpace={authState === 'authenticated'} />
					{showsLaunchSplash ? (
						<ArcaneLaunchSplash accentColorHex={accentColorHex} onFinished={dismissLaunchSplash} />
					) : null}
				</ThemeProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}
