/** Port of Models/Image/ImageAttestation.swift. */
import type { JSONValue } from '../../types/json';

/** Subject an in-toto attestation statement applies to. */
export interface ImageAttestationSubject {
	name: string;
	digest: Record<string, string>;
}

/** One in-toto attestation attached to an image (provenance, SBOM, ...). */
export interface ImageAttestation {
	digest: string;
	mediaType: string;
	artifactType?: string;
	predicateType: string;
	statementType?: string;
	subject?: ImageAttestationSubject[];
	platform?: string;
	size: number;
	/** Full statement payload; present only when requested with `statement=true`. */
	statement?: JSONValue;
}

export const ImageAttestation = {
	/** Swift `Identifiable.id`. */
	id(value: ImageAttestation): string {
		return value.digest + value.predicateType + (value.platform ?? '');
	}
} as const;

/** Response of `GET /environments/{id}/images/{name}/attestations`. */
export interface ImageAttestationList {
	imageRef: string;
	subjectDigest: string;
	platform?: string;
	attestations: ImageAttestation[];
}
