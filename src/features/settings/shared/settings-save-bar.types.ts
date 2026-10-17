/** Shared props for `SettingsSaveBar` (SettingsSaveBar.swift). */
export type SettingsSaveBarProps = {
	/** `settingsSaveBar(isPresented:)`; false renders nothing. Defaults to true. */
	isPresented?: boolean;
	hasChanges: boolean;
	isSaving: boolean;
	canSave?: boolean;
	isInteractionDisabled?: boolean;
	saveAccessibilityLabel?: string;
	onSave: () => void;
	onRevert: () => void;
	/** Pushed tab-stack screens float above the tab bar; sheets pass false. Defaults to true. */
	reservesTabBarSpace?: boolean;
};

/** Height the floating bar occupies above the bottom edge (52pt buttons + 10 top + 18 bottom padding). */
export const settingsSaveBarHeight = 80;

export function saveBarState({
	hasChanges,
	isSaving,
	canSave = true,
	isInteractionDisabled = false
}: SettingsSaveBarProps) {
	const saveDisabled = !hasChanges || !canSave || isSaving || isInteractionDisabled;
	const revertDisabled = isSaving || isInteractionDisabled;
	return { saveDisabled, revertDisabled };
}
