import { SettingsCategoryView } from '@/ui/components/settings-form';
import { timeoutSettings } from '@/ui/components/settings-form.types';

export function TimeoutsDestination() {
	return <SettingsCategoryView category={timeoutSettings} />;
}
