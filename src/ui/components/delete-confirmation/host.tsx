/**
 * Port of `DeleteConfirmationHost`: renders the presenter's request when it
 * targets this host, as a plain full-screen overlay (never a modal). Mount one
 * at the app root and one inside any sheet that raises confirmations.
 *
 * Standalone (RN overlay; the card itself is SwiftUI on iOS, Material 3 on Android).
 */
import { StyleSheet, View } from 'react-native';

import { DeleteConfirmationCard } from './card';
import {
	ROOT_CONFIRMATION_HOST,
	clearDeleteConfirmation,
	useDeleteConfirmationPresenter
} from './presenter';

export function DeleteConfirmationHost({ hostID = ROOT_CONFIRMATION_HOST }: { hostID?: string }) {
	const request = useDeleteConfirmationPresenter((s) => s.request);
	const isMine = request?.hostID === hostID;
	return (
		<View pointerEvents={isMine ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
			{request && isMine ? (
				<DeleteConfirmationCard
					// Fresh identity per request so the entrance runs every time.
					key={request.id}
					config={request.config}
					onResolved={(action) => {
						action?.();
						if (action && (request.config.dismissOnConfirm ?? true)) request.onConfirmDismiss();
						clearDeleteConfirmation();
					}}
				/>
			) : null}
		</View>
	);
}
