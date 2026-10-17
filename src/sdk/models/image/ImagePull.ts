/** Port of Models/Image/ImagePull.swift. */
import type { ContainerRegistryCredential } from '../containerRegistry/ContainerRegistry';

/** Request body for the image pull endpoint. */
export interface ImagePullOptions {
	imageName: string;
	tag?: string;
	auth?: ContainerRegistryCredential;
	credentials?: ContainerRegistryCredential[];
}
