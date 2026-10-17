/** Minimal environment shape for the switcher (subset of the SDK `Environment`). */
export type PickerEnvironment = {
	id: string;
	displayName: string;
	apiUrl: string;
	status: string;
	enabled: boolean;
};

export type EnvironmentContextPickerProps = {
	environments: PickerEnvironment[];
	activeEnvironmentID: string;
	onSelect: (environment: PickerEnvironment) => void;
	onCancel: () => void;
};

/** Enabled environments plus the active one, sorted like Finder (`localizedStandardCompare`). */
export function selectableEnvironments(
	environments: PickerEnvironment[],
	activeEnvironmentID: string
) {
	return environments
		.filter((e) => e.enabled || e.id === activeEnvironmentID)
		.sort((a, b) =>
			a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' })
		);
}

export function filterEnvironments(environments: PickerEnvironment[], search: string) {
	const query = search.trim().toLocaleLowerCase();
	if (!query) return environments;
	return environments.filter(
		(e) =>
			e.displayName.toLocaleLowerCase().includes(query) ||
			e.apiUrl.toLocaleLowerCase().includes(query)
	);
}

/** Navigation subtitle under a resource screen's title (`environmentSubtitle`). */
export function environmentSubtitle({
	allEnvironmentsPreview,
	active,
	activeEnvironmentName
}: {
	allEnvironmentsPreview: boolean;
	active?: PickerEnvironment;
	activeEnvironmentName: string;
}) {
	if (allEnvironmentsPreview) return 'All Environments · Preview';
	if (!active) return activeEnvironmentName;
	const status = active.status.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
	return `${active.displayName}, ${status}`;
}

export type EnvironmentSwitcherButtonProps = {
	environments: PickerEnvironment[];
	activeEnvironmentID: string;
	activeEnvironmentName: string;
	allEnvironmentsPreview: boolean;
	/** Present `EnvironmentContextPicker` (a medium/large sheet). */
	onPress: () => void;
	/** Toolbar side; the Dashboard puts it on the leading side. Defaults to "right". */
	placement?: 'left' | 'right';
};
