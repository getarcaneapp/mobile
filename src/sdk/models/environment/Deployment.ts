export interface DeploymentSnippetFile {
	name: string;
	content?: string;
	downloadUrl?: string;
	sensitive?: boolean;
	containerPath: string;
	permissions: string;
}

export interface DeploymentSnippetMTLS {
	dockerRun: string;
	dockerCompose: string;
	files: DeploymentSnippetFile[];
	hostDirHint: string;
}

export const DeploymentSnippetMTLS = {
	make(
		args: Omit<DeploymentSnippetMTLS, 'files'> & { files?: DeploymentSnippetFile[] }
	): DeploymentSnippetMTLS {
		return { ...args, files: args.files ?? [] };
	}
} as const;

export interface DeploymentSnippet {
	dockerRun: string;
	dockerCompose: string;
	mtls?: DeploymentSnippetMTLS;
}
