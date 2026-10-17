import { fetch as expoFetch } from 'expo/fetch';
import type { FetchLike } from '../http/fetching';

export const expoStreamingFetch: FetchLike = (input, init) =>
	expoFetch(input, init as Parameters<typeof expoFetch>[1]) as unknown as ReturnType<FetchLike>;
