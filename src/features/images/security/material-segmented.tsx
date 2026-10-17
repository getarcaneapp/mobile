/**
 * Material 3 single-choice segmented buttons (Compose
 * `SingleChoiceSegmentedButtonRow`) for the Android security screens: the
 * stand-in for SwiftUI's `.pickerStyle(.segmented)`.
 *
 * Android only (imported from `.android.tsx` files). Standalone (own Host).
 */
import { Host } from '@expo/ui';
import {
	SegmentedButton,
	SingleChoiceSegmentedButtonRow,
	Text as ComposeText
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import type { StyleProp, ViewStyle } from 'react-native';

export function MaterialSegmentedButtons<Value extends string | number>({
	options,
	selection,
	onSelect,
	style
}: {
	options: readonly { value: Value; title: string }[];
	selection: Value;
	onSelect: (value: Value) => void;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<Host matchContents={{ vertical: true }} style={[{ alignSelf: 'stretch' }, style]}>
			<SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
				{options.map((option) => (
					<SegmentedButton
						key={String(option.value)}
						selected={option.value === selection}
						onClick={() => onSelect(option.value)}
					>
						<SegmentedButton.Label>
							<ComposeText>{option.title}</ComposeText>
						</SegmentedButton.Label>
					</SegmentedButton>
				))}
			</SingleChoiceSegmentedButtonRow>
		</Host>
	);
}
