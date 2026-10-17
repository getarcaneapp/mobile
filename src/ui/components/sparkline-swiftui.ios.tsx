import { HStack, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityHidden, frame } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { Sparkline, type SparklineProps } from './sparkline';

export function SparklineSwiftUI(props: SparklineProps) {
	const height = props.height ?? 36;
	return (
		<HStack
			modifiers={[
				frame({ maxWidth: Infinity, minHeight: height, maxHeight: height }),
				accessibilityHidden(true)
			]}
		>
			<RNHostView>
				<View style={{ flex: 1, height }}>
					<Sparkline {...props} height={height} />
				</View>
			</RNHostView>
		</HStack>
	);
}
