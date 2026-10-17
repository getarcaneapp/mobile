/**
 * `UIActivityViewController` hand-off for files (Swift `LogDownloadShareSheet`
 * / `LogActivityShareSheet`): write or download into the cache directory, then
 * present the system share sheet.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ArcaneAuthorizedRequest } from '@/sdk/client/ArcaneTransport';

/** Writes `text` to a temporary file and shares it. Throws when the write fails. */
export async function shareTextFile(filename: string, text: string) {
	const file = new File(Paths.cache, filename);
	if (file.exists) file.delete();
	file.create();
	await file.write(text);
	await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text' });
}

/** Streams an authenticated download to a temporary file and shares it. */
export async function downloadAndShare(request: ArcaneAuthorizedRequest, filename: string) {
	const file = new File(Paths.cache, filename);
	const downloaded = await File.downloadFileAsync(request.url, file, {
		headers: request.headers,
		idempotent: true
	});
	await Sharing.shareAsync(downloaded.uri, { mimeType: 'text/plain', UTI: 'public.plain-text' });
}
