import { usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { storage } from '@/core/storage';
import { AppSettingsRoutes } from '@/features/settings/app/app-settings-routes';
import {
	AllEnvironmentsIntroduction,
	RefreshedDashboardIntroduction
} from '@/features/settings/app/preview-walkthrough';
import { useLaunchSplash } from '@/stores/launch-splash-store';

import { automaticWhatsNew, migrateLegacyPresentation } from './whats-new-model';

const sheetDismissalDelay = 450;

function nextIntroduction(): string | undefined {
	if (!(storage.bool(AllEnvironmentsIntroduction.seenKey) ?? false))
		return AppSettingsRoutes.allEnvironmentsIntroduction;
	if (!(storage.bool(RefreshedDashboardIntroduction.seenKey) ?? false))
		return AppSettingsRoutes.refreshedDashboardIntroduction;
	return undefined;
}

export function useAutomaticWhatsNewPresentation() {
	const router = useRouter();
	const pathname = usePathname();
	const segments = useSegments() as string[];
	const isLaunchSplashPresented = useLaunchSplash((s) => s.isPresented);
	const didEvaluate = useRef(false);
	const presented = useRef<{ path: string; appeared: boolean } | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const group =
		segments.find((segment, index) => index > 0 && /^\(.+\)$/.test(segment)) ?? '(more)';
	const groupRef = useRef(group);
	useEffect(() => {
		groupRef.current = group;
	}, [group]);

	const present = (path: string, href: Href) => {
		presented.current = { path, appeared: false };
		router.push(href);
	};

	const presentNextIntroduction = () => {
		const route = nextIntroduction();
		if (route) present(`/${route}`, `/(tabs)/${groupRef.current}/${route}` as Href);
	};

	useEffect(() => {
		if (isLaunchSplashPresented || didEvaluate.current) return;
		didEvaluate.current = true;
		migrateLegacyPresentation();
		timer.current = setTimeout(() => {
			const whatsNew = automaticWhatsNew();
			if (whatsNew) {
				present(
					'/whats-new',
					`/whats-new?version=${encodeURIComponent(whatsNew.version)}&automatic=1` as Href
				);
			} else {
				presentNextIntroduction();
			}
		}, 0);
	}, [isLaunchSplashPresented]);

	useEffect(() => {
		const current = presented.current;
		if (!current) return;
		if (pathname === current.path) {
			current.appeared = true;
			return;
		}
		if (!current.appeared) return;
		presented.current = null;
		clearTimeout(timer.current);
		timer.current = setTimeout(presentNextIntroduction, sheetDismissalDelay);
	}, [pathname]);

	useEffect(() => () => clearTimeout(timer.current), []);
}
