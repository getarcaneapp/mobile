/**
 * Shared state for `WhatsNewPresentationView` (WhatsNewView.swift): which
 * release the sheet shows, its Continue action, and the version-store save on
 * disappear (only for the automatic presentation, which passes a store).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import {
	latestWhatsNew,
	WhatsNewVersionStore,
	whatsNewForVersion,
	type WhatsNewPresentation
} from './whats-new-model';

export type WhatsNewRouteParams = {
	/** Version description of the release to show; omitted shows the latest release. */
	version?: string;
	/** "1" when presented automatically after an update (saves the version on dismissal). */
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

	// `.onDisappear { versionStore?.save(presentedVersion: whatsNew.version) }`
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
