import type { JSONValue } from '../../types/json';

export interface ImageAttestationSubject {
	name: string;
	digest: Record<string, string>;
}

export interface ImageAttestation {
	digest: string;
	mediaType: string;
	artifactType?: string;
	predicateType: string;
	statementType?: string;
	subject?: ImageAttestationSubject[];
	platform?: string;
	size: number;
	statement?: JSONValue;
}

export const ImageAttestation = {
	id(value: ImageAttestation): string {
		return value.digest + value.predicateType + (value.platform ?? '');
	}
} as const;

export interface ImageAttestationList {
	imageRef: string;
	subjectDigest: string;
	platform?: string;
	attestations: ImageAttestation[];
}
