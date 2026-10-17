/**
 * Root of the Activity Center sheet (ContentView.swift): `ActivitiesView` in
 * its own NavigationStack with a leading Done, plus the sheet's own toast host
 * (`.toastHost(reservesTabBarSpace: false)`).
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ToastHost } from '@/ui/toast';

import { ActivitiesScreen } from './activities-screen';

export function ActivityCenterSheet() {
	const router = useRouter();
	return (
		<View style={{ flex: 1 }}>
			<ActivitiesScreen onDone={() => router.dismiss()} />
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
