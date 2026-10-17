/**
 * A Material 3 modal bottom sheet (Compose `ModalBottomSheet`) hosting React
 * Native content — the Android rendering of SwiftUI `.sheet`s on the dashboard.
 *
 * Standalone. Android only (Compose); import it from `.android.tsx` files.
 */
import { Host } from '@expo/ui';
import { ModalBottomSheet, RNHostView } from '@expo/ui/jetpack-compose';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export function MaterialSheet({
	isPresented,
	onDismiss,
	fullHeight = false,
	children
}: {
	isPresented: boolean;
	onDismiss: () => void;
	/** Opens fully expanded (Swift `.large` first). */
	fullHeight?: boolean;
	children: ReactNode;
}) {
	if (!isPresented) return null;
	return (
		<Host style={{ position: 'absolute' }}>
			<ModalBottomSheet
				onDismissRequest={onDismiss}
				skipPartiallyExpanded={fullHeight}
				showDragHandle
			>
				<RNHostView matchContents={{ vertical: true }}>
					<View>{children}</View>
				</RNHostView>
			</ModalBottomSheet>
		</Host>
	);
}
