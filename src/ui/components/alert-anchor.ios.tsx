import { Alert, Rectangle } from '@expo/ui/swift-ui';
import { accessibilityHidden, foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';

export function AlertAnchor() {
	return (
		<Alert.Trigger>
			<Rectangle
				modifiers={[
					foregroundStyle('#00000000'),
					frame({ width: 0, height: 0 }),
					accessibilityHidden(true)
				]}
			/>
		</Alert.Trigger>
	);
}
