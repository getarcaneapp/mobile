import { HStack, ProgressView, RNHostView, Text } from '@expo/ui/swift-ui';
import { accessibilityLabel, frame } from '@expo/ui/swift-ui/modifiers';

import { useReduceMotion } from './accessibility';
import { ArcaneLoadingView, type ArcaneLoadingViewProps } from './arcane-loading-view';

export function ArcaneLoadingViewSwiftUI({
	label,
	variant = 'regular',
	fillsWidth = false
}: ArcaneLoadingViewProps & { fillsWidth?: boolean }) {
	const reduceMotion = useReduceMotion();
	const width = fillsWidth ? [frame({ maxWidth: Infinity })] : [];
	if (reduceMotion) {
		return (
			<ProgressView modifiers={[...width, accessibilityLabel(label ?? 'Loading')]}>
				{label ? <Text>{label}</Text> : null}
			</ProgressView>
		);
	}
	return (
		<HStack modifiers={width}>
			<RNHostView matchContents>
				<ArcaneLoadingView label={label} variant={variant} />
			</RNHostView>
		</HStack>
	);
}
