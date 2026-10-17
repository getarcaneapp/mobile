/** Port of Models/Environment/Deployment.swift. */

/** One generated PEM file used by edge mTLS deployments. */
export interface DeploymentSnippetFile {
	name: string;
	content?: string;
	downloadUrl?: string;
	sensitive?: boolean;
	containerPath: string;
	permissions: string;
}

/** Arcane-generated mTLS deployment assets. */
export interface DeploymentSnippetMTLS {
	dockerRun: string;
	dockerCompose: string;
	files: DeploymentSnippetFile[];
	hostDirHint: string;
}

export const DeploymentSnippetMTLS = {
	/** Swift init default: `files: []`. */
	make(
		args: Omit<DeploymentSnippetMTLS, 'files'> & { files?: DeploymentSnippetFile[] }
	): DeploymentSnippetMTLS {
		return { ...args, files: args.files ?? [] };
	}
} as const;

/** Response payload for `GET environments/{id}/deployment`. */
export interface DeploymentSnippet {
	dockerRun: string;
	dockerCompose: string;
	mtls?: DeploymentSnippetMTLS;
}
