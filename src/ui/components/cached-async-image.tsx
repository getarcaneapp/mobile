/**
 * Port of `CachedAsyncImage` + `ImageCache` (CachedAsyncImage.swift).
 * expo-image supplies the memory + disk cache and in-flight dedup the Swift
 * actor implemented by hand; this module keeps the URL rules (server-relative
 * paths, SVG → PNG CDN swaps), the `tiled` well, the fallback-until-loaded
 * behavior, and the cache-generation bump that reloads every visible icon.
 *
 * Standalone (RN view, both platforms). SwiftUI trees: `CachedAsyncImageSwiftUI`.
 */
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { create } from 'zustand';

import { useClientManager } from '@/stores/client-manager';
import { Radius } from '@/theme/tokens';

// MARK: - Cache generation

/** Port of `ImageCacheGeneration`: bumped when the shared image cache is cleared. */
export const useImageCacheGeneration = create<{ value: number }>(() => ({ value: 0 }));

/** `ImageCache.clear()`: drops memory + disk caches and reloads every visible image. */
export async function clearImageCache() {
	await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
	loadedThisSession.clear();
	useImageCacheGeneration.setState((s) => ({ value: s.value + 1 }));
}

// MARK: - URL rules

/** UIImage can't decode SVG; swap known CDN SVG paths for their PNG equivalents. */
export function preferPNG(url: string): string {
	if (!url.endsWith('.svg')) return url;
	// homarr-labs / walkxcode dashboard-icons CDN, or any jsDelivr /svg/ icon path.
	if (
		url.includes('/dashboard-icons/svg/') ||
		(url.includes('cdn.jsdelivr.net') && url.includes('/svg/'))
	) {
		return url.replaceAll('/svg/', '/png/').replaceAll('.svg', '.png');
	}
	return url;
}

/** Resolves server-relative paths against the configured server URL. */
export function resolveImageURL(url: string | undefined, serverURL: string): string | undefined {
	if (!url) return undefined;
	if (url.startsWith('/')) {
		if (!serverURL) return undefined;
		try {
			return preferPNG(new URL(url, serverURL).toString());
		} catch {
			return undefined;
		}
	}
	return preferPNG(url);
}

function isSameOrigin(url: string, serverURL: string) {
	try {
		return new URL(url).origin === new URL(serverURL).origin;
	} catch {
		return false;
	}
}

// MARK: - View

export type CachedAsyncImageProps = {
	url?: string;
	size?: number;
	/** Draws a loaded icon inset (64%) on a neutral tile, matching `RowIcon` wells. */
	tiled?: boolean;
	/** Auth headers, sent only to the configured server's origin. */
	headers?: Record<string, string>;
	/** Shown until (and unless) the image loads. */
	fallback: ReactNode;
};

/**
 * Load identities that have decoded this session: the synchronous
 * `ImageCache.shared[url]` hit in Swift. Rows mounting with a known identity
 * draw the image (and its tile) on the first frame instead of flashing the
 * fallback, which made every list reload flicker.
 */
const loadedThisSession = new Set<string>();

/** Shared load state for both renderers. */
export function useCachedImageSource(url: string | undefined, headers?: Record<string, string>) {
	const serverURL = useClientManager((s) => s.serverURL);
	const generation = useImageCacheGeneration((s) => s.value);
	const resolved = resolveImageURL(url, serverURL);
	const loadID = `${resolved ?? ''}|${generation}`;
	const [loadedID, setLoadedID] = useState<string | undefined>(() =>
		loadedThisSession.has(loadID) ? loadID : undefined
	);
	const source = resolved
		? {
				uri: resolved,
				headers: headers && isSameOrigin(resolved, serverURL) ? headers : undefined,
				cacheKey: resolved
			}
		: undefined;
	return {
		source,
		loadID,
		// A row reappearing with the same identity keeps its image instead of flashing the fallback.
		isLoaded: loadedID === loadID || loadedThisSession.has(loadID),
		onLoad: () => {
			loadedThisSession.add(loadID);
			setLoadedID(loadID);
		},
		onError: () => {
			loadedThisSession.delete(loadID);
			setLoadedID(undefined);
		}
	};
}

export function CachedAsyncImage({
	url,
	size = 36,
	tiled = false,
	headers,
	fallback
}: CachedAsyncImageProps) {
	const { source, loadID, isLoaded, onLoad, onError } = useCachedImageSource(url, headers);
	const inner = tiled ? size * 0.64 : size;
	return (
		<View
			style={[
				{ width: size, height: size, alignItems: 'center', justifyContent: 'center' },
				tiled && isLoaded
					? { backgroundColor: '#8E8E931F', borderRadius: Radius.small, borderCurve: 'continuous' }
					: null
			]}
		>
			{!isLoaded ? (
				<View style={{ position: 'absolute', width: size, height: size }}>{fallback}</View>
			) : null}
			{source ? (
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
			) : null}
		</View>
	);
}
