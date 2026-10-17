import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ArcaneAuthorizedRequest } from '@/sdk/client/ArcaneTransport';

export async function shareTextFile(filename: string, text: string) {
	const file = new File(Paths.cache, filename);
	if (file.exists) file.delete();
	file.create();
	await file.write(text);
	await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text' });
}

export async function downloadAndShare(request: ArcaneAuthorizedRequest, filename: string) {
	const file = new File(Paths.cache, filename);
	const downloaded = await File.downloadFileAsync(request.url, file, {
		headers: request.headers,
		idempotent: true
	});
	await Sharing.shareAsync(downloaded.uri, { mimeType: 'text/plain', UTI: 'public.plain-text' });
}
