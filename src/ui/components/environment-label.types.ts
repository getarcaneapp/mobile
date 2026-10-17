export type ListEnvironment = { id: string; name?: string };

export type EnvironmentLoadFailure = { id: string; environment: ListEnvironment; message: string };

export const environmentTitle = (environment: ListEnvironment) =>
	environment.name ?? environment.id;

export type EnvironmentLabelProps = {
	name?: string;
	color?: string;
};

export type EnvironmentFilterSectionProps = {
	environments: ListEnvironment[];
	selection?: string;
	onSelectionChange: (id: string | undefined) => void;
};

export type EnvironmentLoadFailuresSectionProps = {
	failures: EnvironmentLoadFailure[];
	retry: () => void;
};

export type EnvironmentActionButtonProps = {
	title: string;
	systemImage: string;
	environments: ListEnvironment[];
	action: (environmentID: string) => void;
};

export const environmentActionIsMenu = (environments: ListEnvironment[]) =>
	environments.length > 1 || environments[0]?.name !== undefined;

export const showsEnvironmentFilter = (environments: ListEnvironment[]) =>
	environments.some((e) => e.name !== undefined);
