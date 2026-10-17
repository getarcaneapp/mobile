import type { ContainerRegistryCredential } from '../containerRegistry/ContainerRegistry';

export interface ImagePullOptions {
	imageName: string;
	tag?: string;
	auth?: ContainerRegistryCredential;
	credentials?: ContainerRegistryCredential[];
}
