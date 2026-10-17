/**
 * Root of the Dashboard's image updates sheet: `AllEnvironmentsImageUpdatesView`
 * with `dismissOnOperationStart: true` (starting an update dismisses the sheet)
 * and the sheet's own toast host (`.toastHost(reservesTabBarSpace: false)`).
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ToastHost } from '@/ui/toast';

import { ImageUpdatesView } from './image-updates-view';

export function ImageUpdatesSheet() {
	const router = useRouter();
	return (
		<View style={{ flex: 1 }}>
			<ImageUpdatesView dismissOnOperationStart onDismiss={() => router.dismiss()} />
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
