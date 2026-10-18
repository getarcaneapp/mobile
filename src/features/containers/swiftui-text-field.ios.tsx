import { TextField, useNativeState } from '@expo/ui/swift-ui';
import type { ModifierConfig } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';

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
	const state = useNativeState(value);
	useEffect(() => {
		if (state.get() !== value) state.set(value);
	}, [state, value]);
	return (
		<TextField
			text={state}
			placeholder={placeholder}
			axis={axis}
			onTextChange={onChangeText}
			modifiers={modifiers}
		/>
	);
}
