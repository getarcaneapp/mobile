/**
 * Android rendering of the action-failure `.alert(...)`: a Material dialog
 * with a single OK button. Renders nothing itself.
 */
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

export function ActionErrorAlert({
	title,
	message,
	onDismiss
}: {
	title: string;
	message: string | undefined;
	onDismiss: () => void;
}) {
	const dismiss = useRef(onDismiss);
	dismiss.current = onDismiss;
	useEffect(() => {
		if (message === undefined) return;
		Alert.alert(
			title,
			message,
			[{ text: 'OK', style: 'cancel', onPress: () => dismiss.current() }],
			{
				cancelable: true,
				onDismiss: () => dismiss.current()
			}
		);
	}, [title, message]);
	return null;
}
