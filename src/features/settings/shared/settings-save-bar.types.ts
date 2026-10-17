export type SettingsSaveBarProps = {
	isPresented?: boolean;
	hasChanges: boolean;
	isSaving: boolean;
	canSave?: boolean;
	isInteractionDisabled?: boolean;
	saveAccessibilityLabel?: string;
	onSave: () => void;
	onRevert: () => void;
	reservesTabBarSpace?: boolean;
};

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
