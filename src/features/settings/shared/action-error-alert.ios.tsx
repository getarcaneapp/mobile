/**
 * `.alert(title, isPresented: actionErrorMessage != nil) { OK } message: { … }`
 * for failed row actions (delete / remove).
 *
 * SwiftUI-tree: place inside the screen's `Host`.
 */
import { Alert, Button, Text } from '@expo/ui/swift-ui';
import { AlertAnchor } from '@/ui/components/alert-anchor';

export function ActionErrorAlert({
	title,
	message,
	onDismiss
}: {
	title: string;
	message: string | undefined;
	onDismiss: () => void;
}) {
	return (
		<Alert
			title={title}
			isPresented={message !== undefined}
			onIsPresentedChange={(presented) => {
				if (!presented) onDismiss();
			}}
		>
			<AlertAnchor />
			<Alert.Actions>
				<Button label="OK" role="cancel" onPress={onDismiss} />
			</Alert.Actions>
			<Alert.Message>
				<Text>{message ?? ''}</Text>
			</Alert.Message>
		</Alert>
	);
}
