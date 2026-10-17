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
