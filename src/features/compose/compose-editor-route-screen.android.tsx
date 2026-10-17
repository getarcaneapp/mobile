import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { useProjectNavigation } from '@/features/projects/project-routes';
import { CenteredMessage } from '@/features/containers/android-material';

import { decodeComposeDestination, encodeComposeDestination } from './compose-destinations';
import { ComposeDestinationScreen, ComposeNavigationContext } from './compose-screens-android';
import { useComposeSessionStore } from './compose-session';

export function ComposeEditorRouteScreen() {
	const { destination: value } = useLocalSearchParams<{ destination?: string }>();
	const nav = useProjectNavigation();
	const destination = useMemo(() => (value ? decodeComposeDestination(value) : undefined), [value]);
	const sessionExists = useComposeSessionStore((state) =>
		destination ? state.sessions[destination.binding.session] !== undefined : false
	);
	const context = useMemo(
		() => ({
			push: (next: Parameters<typeof encodeComposeDestination>[0]) =>
				nav.openComposeEditor(encodeComposeDestination(next)),
			mode: 'route' as const
		}),
		[nav]
	);
	if (!destination || !sessionExists) {
		return (
			<CenteredMessage
				icon="doc.text"
				title="Editor unavailable"
				message="Reopen the editor and try again."
			/>
		);
	}
	return (
		<ComposeNavigationContext.Provider value={context}>
			<ComposeDestinationScreen destination={destination} />
		</ComposeNavigationContext.Provider>
	);
}
