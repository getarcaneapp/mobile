/**
 * SwiftUI `Image` that behaves like SwiftUI's: with no `font` modifier it
 * inherits the surrounding font (e.g. `HStack { Image; Text }.font(.subheadline)`).
 *
 * `@expo/ui`'s `Image` instead appends `font(size: 24)` whenever the image has
 * no font modifier of its own, so every inherited symbol rendered at 24pt.
 * Same native view and props; only `size` must now be passed explicitly.
 *
 * SwiftUI-tree.
 */
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

/** `createViewModifierEventListener` from @expo/ui (not exported publicly). */
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
