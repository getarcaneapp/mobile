import { useRouter, useSegments, type Href } from 'expo-router';
import { useCallback } from 'react';

import type { EnvironmentID } from '@/sdk/client/environment';

import type { SettingFieldDef } from './settings-form.types';

export type ContainerMultiSelectParams = {
	id: string;
	draft?: string;
	field?: string;
	title?: string;
};

export function useOpenContainerMultiSelect(environmentID: EnvironmentID, draftToken: string) {
	const router = useRouter();
	const segments = useSegments() as string[];
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(more)';
	return useCallback(
		(field: SettingFieldDef) => {
			const query = `draft=${encodeURIComponent(draftToken)}&field=${encodeURIComponent(field.key)}&title=${encodeURIComponent(field.label)}`;
			router.push(
				`/(tabs)/${group}/environment/${encodeURIComponent(environmentID)}/excluded-containers?${query}` as Href
			);
		},
		[router, group, environmentID, draftToken]
	);
}
