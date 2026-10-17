/**
 * Default streaming fetch: `expo/fetch` exposes `response.body.getReader()`
 * on native, which React Native's global `fetch` does not. Kept in its own
 * module so pure-logic tests never import Expo.
 */
import { fetch as expoFetch } from 'expo/fetch';
import type { FetchLike } from '../http/fetching';

export const expoStreamingFetch: FetchLike = (input, init) =>
	expoFetch(input, init as Parameters<typeof expoFetch>[1]) as unknown as ReturnType<FetchLike>;
