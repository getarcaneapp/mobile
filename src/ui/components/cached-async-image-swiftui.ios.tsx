/**
 * `CachedAsyncImage` for SwiftUI trees: the SwiftUI `fallback` shows until
 * the expo-image (hosted in an `RNHostView`) has loaded, then the image
 * replaces it at the same `size` frame.
 *
 * SwiftUI-tree.
 */
import { RNHostView, ZStack } from '@expo/ui/swift-ui';
import { background, frame, shapes } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Radius } from '@/theme/tokens';

import { useCachedImageSource, type CachedAsyncImageProps } from './cached-async-image';

export function CachedAsyncImageSwiftUI({
	url,
	size = 36,
	tiled = false,
	headers,
	fallback
}: Omit<CachedAsyncImageProps, 'fallback'> & { fallback: ReactNode }) {
	const { source, loadID, isLoaded, onLoad, onError } = useCachedImageSource(url, headers);
	const inner = tiled ? size * 0.64 : size;
	return (
		<ZStack
			modifiers={[
				frame({ width: size, height: size }),
				...(tiled && isLoaded
					? [
							background(
								'#8E8E931F',
								shapes.roundedRectangle({
									cornerRadius: Radius.small,
									roundedCornerStyle: 'continuous'
								})
							)
						]
					: [])
			]}
		>
			{!isLoaded ? (
				<ZStack modifiers={[frame({ width: size, height: size })]}>{fallback}</ZStack>
			) : null}
			{source ? (
				// A fixed SwiftUI frame keeps the RN host centered in the tile instead of
				// filling it with the image pinned to the top-left.
				<ZStack modifiers={[frame({ width: inner, height: inner })]}>
					<RNHostView matchContents>
						<View style={{ width: inner, height: inner }}>
							<Image
								key={loadID}
								source={source}
								recyclingKey={loadID}
								cachePolicy="memory-disk"
								contentFit="contain"
								transition={0}
								onLoad={onLoad}
								onError={onError}
								style={{ width: inner, height: inner, opacity: isLoaded ? 1 : 0 }}
							/>
						</View>
					</RNHostView>
				</ZStack>
			) : null}
		</ZStack>
	);
}
