import type { ISODateString } from '../base/date';

export interface S3Destination {
	id: string;
	name: string;
	endpoint?: string;
	bucket: string;
	region: string;
	accessKeyId: string;
	prefix?: string;
	useSsl: boolean;
	forcePathStyle: boolean;
	secretConfigured: boolean;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
}
