import { titleCasedWords } from '@/core/title-case';

const storageTitles: Record<string, string> = {
	local: 'Local',
	s3: 'S3',
	local_s3: 'Local and S3'
};

export function backupStatusTitle(status: string): string {
	return status === '' ? 'Unknown' : titleCasedWords(status);
}

export function backupDestinationTitle(destination: string): string {
	return storageTitles[destination.toLowerCase()] ?? titleCasedWords(destination);
}
