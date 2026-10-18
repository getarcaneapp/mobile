import { TextField } from '@expo/ui/swift-ui';
import type { ModifierConfig } from '@expo/ui/swift-ui/modifiers';

import { useSyncedNativeText } from '@/ui/components/synced-native-text';

export function BoundTextField({
	placeholder,
	value,
	onChangeText,
	axis,
	modifiers
}: {
	placeholder: string;
	value: string;
	onChangeText: (text: string) => void;
	axis?: 'horizontal' | 'vertical';
	modifiers?: ModifierConfig[];
}) {
	const { state, onTextChange } = useSyncedNativeText(value, onChangeText);
	return (
		<TextField
			text={state}
			placeholder={placeholder}
			axis={axis}
			onTextChange={onTextChange}
			modifiers={modifiers}
		/>
	);
}
