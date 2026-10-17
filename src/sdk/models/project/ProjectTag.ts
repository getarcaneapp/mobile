/** Port of Models/Project/ProjectTag.swift. */

/** A project's effective tag, including its UI and Compose sources. */
export interface ProjectTag {
	name: string;
	color: string;
	sources: string[];
}

export const ProjectTag = {
	make(args: { name: string; color: string; sources?: string[] }): ProjectTag {
		return {
			name: args.name,
			color: args.color,
			sources: args.sources ?? []
		};
	}
} as const;
