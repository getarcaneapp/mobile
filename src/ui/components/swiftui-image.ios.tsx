import type { ImageProps } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { requireNativeView } from 'expo';

type ModifierList = NonNullable<ImageProps['modifiers']>;

type NativeImageProps = Omit<ImageProps, 'onPress' | 'size' | 'color'> & {
	useTapGesture?: boolean;
	onTap?: () => void;
	onGlobalEvent?: (event: { nativeEvent: Record<string, Record<string, unknown>> }) => void;
};

const ImageNativeView = requireNativeView<NativeImageProps>('ExpoUI', 'ImageView');

function modifierEvents(modifiers: ModifierList): Pick<NativeImageProps, 'onGlobalEvent'> {
	const listeners: Record<string, (args: unknown) => void> = {};
	for (const modifier of modifiers) {
		if (modifier.eventListener) listeners[modifier.$type] = modifier.eventListener;
	}
	return {
		onGlobalEvent: ({ nativeEvent }) => {
			for (const [name, params] of Object.entries(nativeEvent)) listeners[name]?.(params);
		}
	};
}

export function Image({ onPress, modifiers, size, color, ...rest }: ImageProps) {
	const all: ModifierList = [
		...(modifiers ?? []),
		...(size !== undefined && !modifiers?.some((m) => m.$type === 'font') ? [font({ size })] : []),
		...(color != null ? [foregroundStyle(color)] : [])
	];
	return (
		<ImageNativeView
			{...rest}
			modifiers={all}
			{...modifierEvents(all)}
			{...(onPress ? { useTapGesture: true, onTap: onPress } : null)}
		/>
	);
}
