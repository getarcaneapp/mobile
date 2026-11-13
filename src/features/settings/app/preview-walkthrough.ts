import { useEffect, useState } from 'react';

import { storage } from '@/core/storage';
import { useClientManager } from '@/stores/client-manager';

import { useSettingsNavigation } from '../shared/settings-routes';

export type WalkthroughPage = { title: string; message: string };

export type WalkthroughContent = {
	pages: readonly WalkthroughPage[];
	seenKey: string;
	footnote: string;
};

export const AllEnvironmentsIntroduction = {
	seenKey: 'arcane.introduction.allEnvironments.v1.seen'
} as const;
export const RefreshedDashboardIntroduction = {
	seenKey: 'arcane.introduction.refreshedDashboard.v1.seen'
} as const;

export const allEnvironmentsWalkthrough: WalkthroughContent = {
	pages: [
		{
			title: 'All your agents.\nOne view.',
			message:
				'See containers, projects, images and more from all enabled agents together. Your dashboard brings their totals into one place.'
		},
		{
			title: 'Know what belongs where.',
			message:
				'Agent names and colors identify every resource. Use filters to focus on one agent without leaving the list.'
		},
		{
			title: 'Manage them together.',
			message:
				'Update checks, updates and pruning apply to all enabled agents, even when a list is filtered. Review the confirmation before running an action.'
		}
	],
	seenKey: AllEnvironmentsIntroduction.seenKey,
	footnote:
		'Optional preview. Turn it off anytime in More → Preview Features. Agent switching is hidden while it’s on.'
};

export const refreshedDashboardWalkthrough: WalkthroughContent = {
	pages: [
		{
			title: 'Your hosts, live.',
			message:
				'A live graph follows CPU and memory on every agent, with the total across all of them up top.'
		},
		{
			title: "Find what's busy.",
			message:
				'The busiest containers across all agents, ranked by CPU or memory. Tap one to open it.'
		},
		{
			title: 'Make it yours.',
			message:
				'Edit Dashboard reorders and hides widgets. Each agent lists its containers, images, volumes and disk.'
		}
	],
	seenKey: RefreshedDashboardIntroduction.seenKey,
	footnote: 'Optional preview. Turn it off anytime in More → Preview Features.'
};

export function useAllEnvironmentsPreviewToggle() {
	const isEnabled = useClientManager((s) => s.allEnvironmentsPreview);
	const setEnabled = useClientManager((s) => s.setAllEnvironmentsPreview);
	return { isEnabled, enable: () => setEnabled(true) };
}

export function useRefreshedDashboardPreviewToggle() {
	const isEnabled = useClientManager((s) => s.refreshedDashboardPreview);
	const setEnabled = useClientManager((s) => s.setRefreshedDashboardPreview);
	return { isEnabled, enable: () => setEnabled(true) };
}

export function usePreviewWalkthrough(content: WalkthroughContent, enable: () => void) {
	const navigation = useSettingsNavigation();
	const [page, setPage] = useState(0);
	const lastPage = content.pages.length - 1;
	const { seenKey } = content;

	useEffect(() => () => storage.set(seenKey, true), [seenKey]);

	const finish = () => {
		storage.set(seenKey, true);
		navigation.back();
	};

	return {
		page,
		setPage: (next: number) => setPage(Math.min(Math.max(next, 0), lastPage)),
		lastPage,
		finish,
		enableAndFinish: () => {
			enable();
			finish();
		}
	};
}
