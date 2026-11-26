import { SettingsCategoryView } from '@/ui/components/settings-form';
import { timeoutSettings, tunnelSettings } from '@/ui/components/settings-form.types';

export function TimeoutsDestination() {
	return <SettingsCategoryView category={timeoutSettings} />;
}

export function TunnelDestination() {
	return <SettingsCategoryView category={tunnelSettings} />;
}
