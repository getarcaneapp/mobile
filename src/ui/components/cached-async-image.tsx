import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { create } from 'zustand';

import { useClientManager } from '@/stores/client-manager';
import { Radius } from '@/theme/tokens';

export const useImageCacheGeneration = create<{ value: number }>(() => ({ value: 0 }));

export async function clearImageCache() {
	await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
	loadedThisSession.clear();
	useImageCacheGeneration.setState((s) => ({ value: s.value + 1 }));
}

export function preferPNG(url: string): string {
	if (!url.endsWith('.svg')) return url;
	if (
		url.includes('/dashboard-icons/svg/') ||
		(url.includes('cdn.jsdelivr.net') && url.includes('/svg/'))
	) {
		return url.replaceAll('/svg/', '/png/').replaceAll('.svg', '.png');
	}
	return url;
}

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

export type CachedAsyncImageProps = {
	url?: string;
	size?: number;
	tiled?: boolean;
	headers?: Record<string, string>;
	fallback: ReactNode;
};

const loadedThisSession = new Set<string>();

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
