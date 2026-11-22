import { Stack } from 'expo-router';

import { useSheetStackScreenOptions } from '@/features/navigation/stack-options';

export default function ImageUpdatesSheetLayout() {
	const screenOptions = useSheetStackScreenOptions();
	return <Stack screenOptions={screenOptions} />;
}
