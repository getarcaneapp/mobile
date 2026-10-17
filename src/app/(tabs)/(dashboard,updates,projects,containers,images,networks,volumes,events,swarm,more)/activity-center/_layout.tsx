import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/features/navigation/stack-options';

/**
 * The Activity Center sheet (ContentView.swift: `.sheet { NavigationStack {
 * ActivitiesView() } }`). A nested stack gives the sheet its own navigation
 * bar (large title, search, toolbar) and keeps activity detail pushes inside it.
 */
export default function ActivityCenterLayout() {
	const screenOptions = useStackScreenOptions();
	return <Stack screenOptions={screenOptions} />;
}
