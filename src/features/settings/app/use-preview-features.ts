import { useStoredBool } from '@/core/storage';
import { composePreviewPreferenceKey } from '@/features/compose/model/compose-preview-session';
import { useClientManager } from '@/stores/client-manager';

import { useSettingsNavigation } from '../shared/settings-routes';
import { AppSettingsRoutes } from './app-settings-routes';

export const ComposePreviewSession = {
	preferenceKey: composePreviewPreferenceKey
} as const;

export function usePreviewFeatures() {
	const navigation = useSettingsNavigation();
	const [nativeComposeEditor, setNativeComposeEditor] = useStoredBool(
		ComposePreviewSession.preferenceKey,
		false
	);
	const refreshedDashboardPreview = useClientManager((s) => s.refreshedDashboardPreview);
	const setRefreshedDashboardPreview = useClientManager((s) => s.setRefreshedDashboardPreview);
	const allEnvironmentsPreview = useClientManager((s) => s.allEnvironmentsPreview);
	const usesV3Defaults = useClientManager((s) => s.apiGeneration === 'v3');
	const setAllEnvironmentsPreview = useClientManager((s) => s.setAllEnvironmentsPreview);

	return {
		nativeComposeEditor,
		setNativeComposeEditor,
		refreshedDashboardPreview,
		setRefreshedDashboardPreview,
		allEnvironmentsPreview,
		setAllEnvironmentsPreview,
		usesV3Defaults,
		showDashboardIntroduction: () =>
			navigation.push(AppSettingsRoutes.refreshedDashboardIntroduction),
		showIntroduction: () => navigation.push(AppSettingsRoutes.allEnvironmentsIntroduction),
		openTilesEditor: () => navigation.push(AppSettingsRoutes.dashboardTiles),
		openEnvironmentColors: () => navigation.push(AppSettingsRoutes.environmentColors)
	};
}

export const PreviewFeaturesCopy = {
	composeFooter: 'Edit Compose files with native forms. YAML editing remains available.',
	dashboardFooter:
		"Replace the dashboard's environment cards with live usage graphs, the busiest containers, and an inventory row for every host. Touch and hold the top tiles to edit them.",
	allEnvironmentsFooter:
		'Show resources from all enabled environments together. Environment switching is unavailable while this preview is on.'
} as const;
