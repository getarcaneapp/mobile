import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/features/navigation/stack-options';

/**
 * The Dashboard's image updates sheet (DashboardView.swift: `.sheet {
 * NavigationStack { AllEnvironmentsImageUpdatesView(dismissOnOperationStart: true) } }`).
 * A nested stack gives the sheet its own navigation bar.
 */
export default function ImageUpdatesSheetLayout() {
	const screenOptions = useStackScreenOptions();
	return <Stack screenOptions={screenOptions} />;
}
