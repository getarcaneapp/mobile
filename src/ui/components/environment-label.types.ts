/** Minimal shape of an All Environments list's environment (Swift `ListEnvironment`). */
export type ListEnvironment = { id: string; name?: string };

/** An environment that failed to load while others succeeded (`EnvironmentLoadFailure`). */
export type EnvironmentLoadFailure = { id: string; environment: ListEnvironment; message: string };

export const environmentTitle = (environment: ListEnvironment) =>
	environment.name ?? environment.id;

export type EnvironmentLabelProps = {
	name?: string;
	/**
	 * Hex color for the row's environment in All Environments mode
	 * (`EnvironmentColorStore`); undefined renders secondary.
	 */
	color?: string;
};

export type EnvironmentFilterSectionProps = {
	environments: ListEnvironment[];
	/** Undefined is "All Environments". */
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

/** In All Environments lists the action becomes a submenu so the user picks the environment. */
export const environmentActionIsMenu = (environments: ListEnvironment[]) =>
	environments.length > 1 || environments[0]?.name !== undefined;

export const showsEnvironmentFilter = (environments: ListEnvironment[]) =>
	environments.some((e) => e.name !== undefined);
