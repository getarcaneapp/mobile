import { children, type AppTab } from '@/core/app-tab';
import { useSettingsNavigation } from '@/features/settings/shared/settings-routes';
import { useClientManager } from '@/stores/client-manager';

export function useNavigationCatalog(parent: AppTab) {
	const navigation = useSettingsNavigation();
	const canAccess = useClientManager((s) => s.canAccess);
	useClientManager((s) => s.accessGeneration);
	return {
		children: children(parent).filter(canAccess),
		open: (child: AppTab) => navigation.push(child)
	};
}
