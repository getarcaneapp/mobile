/** Port of Models/Backup/CreateS3Destination.swift. */

export interface CreateS3Destination {
	name: string;
	endpoint?: string;
	bucket: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	prefix?: string;
	useSsl: boolean;
	forcePathStyle: boolean;
}
