/**
 * Invisible `Alert.Trigger` for state-driven alerts (`.alert(isPresented:)`
 * hung off a screen). @expo/ui's `Alert` renders `EmptyView()` when there is
 * no trigger, and SwiftUI drops modifiers on EmptyView — so without an anchor
 * the alert is never presented. Place inside `<Alert>`.
 *
 * SwiftUI-tree; import only from `.ios.tsx` files.
 */
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
