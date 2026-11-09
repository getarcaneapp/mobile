import { initialAdvancedFeatures } from '@/core/advanced-tabs';
import { defaults, Keys, storage, useStoredBool } from '@/core/storage';

export function migrateAdvancedFeatures(): boolean {
	const stored = defaults.getBoolean(Keys.advancedFeatures);
	const value = initialAdvancedFeatures(stored, storage.has(Keys.serverURL));
	if (stored === undefined) defaults.set(Keys.advancedFeatures, value);
	return value;
}

export function useAdvancedFeatures(): [boolean, (value: boolean) => void] {
	return useStoredBool(Keys.advancedFeatures, false);
}
