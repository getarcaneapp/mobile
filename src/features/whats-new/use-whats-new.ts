import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import {
	latestWhatsNew,
	WhatsNewVersionStore,
	whatsNewForVersion,
	type WhatsNewPresentation
} from './whats-new-model';

export type WhatsNewRouteParams = {
	version?: string;
	automatic?: string;
};

export function useWhatsNewPresentation(): {
	whatsNew: WhatsNewPresentation | undefined;
	dismiss: () => void;
} {
	const router = useRouter();
	const params = useLocalSearchParams<WhatsNewRouteParams>();
	const whatsNew = useMemo(
		() => (params.version ? whatsNewForVersion(params.version) : undefined) ?? latestWhatsNew(),
		[params.version]
	);
	const savesPresentedVersion = params.automatic === '1';
	const version = whatsNew?.version;

	useEffect(
		() => () => {
			if (savesPresentedVersion && version) WhatsNewVersionStore.save(version);
		},
		[savesPresentedVersion, version]
	);

	return {
		whatsNew,
		dismiss: () => {
			if (router.canGoBack()) router.back();
		}
	};
}
