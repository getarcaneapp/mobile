import { systemImage, tabTitle, type AppTab } from '@/core/app-tab';

const quickActionTabs: AppTab[] = ['dashboard', 'containers', 'projects', 'updates'];

export function quickActionTab(action: { params?: Record<string, unknown> | null } | undefined) {
	const tab = action?.params?.tab;
	return quickActionTabs.find((entry) => entry === tab);
}

export function quickActionItems(canAccess: (tab: AppTab) => boolean, ios: boolean) {
	return quickActionTabs.filter(canAccess).map((tab) => ({
		id: tab,
		title: tabTitle[tab],
		icon: ios ? `symbol:${systemImage[tab]}` : null,
		params: { tab }
	}));
}
