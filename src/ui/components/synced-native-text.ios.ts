import { useNativeState } from '@expo/ui/swift-ui';
import { useEffect, useRef } from 'react';

import { isEchoOfEmittedText, rememberEmittedText } from './synced-native-text.types';

export function useSyncedNativeText(value: string, onChange: (text: string) => void) {
	const state = useNativeState(value);
	const emitted = useRef<string[]>([]);
	useEffect(() => {
		const pending = emitted.current;
		if (isEchoOfEmittedText(pending, value)) return;
		pending.length = 0;
		if (state.get() !== value) state.set(value);
	}, [state, value]);
	const onTextChange = (text: string) => {
		rememberEmittedText(emitted.current, text);
		onChange(text);
	};
	return { state, onTextChange };
}
