import { SettingsCategoryView } from '@/ui/components/settings-form';
import { activityHistorySettings } from '@/ui/components/settings-form.types';

export function ActivityHistorySettingsScreen() {
	return <SettingsCategoryView category={activityHistorySettings} />;
}
