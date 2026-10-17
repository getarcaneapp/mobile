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
