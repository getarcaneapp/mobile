import { useMemo } from 'react';

import { children, type AppTab } from '@/core/app-tab';
import { useSettingsNavigation } from '@/features/settings/shared/settings-routes';
import { useClientManager } from '@/stores/client-manager';

export function useNavigationCatalog(parent: AppTab) {
	const navigation = useSettingsNavigation();
	const canAccess = useClientManager((s) => s.canAccess);
	const accessGeneration = useClientManager((s) => s.accessGeneration);
	const available = useMemo(() => {
		void accessGeneration;
		return children(parent).filter(canAccess);
	}, [parent, canAccess, accessGeneration]);
	return {
		children: available,
		open: (child: AppTab) => navigation.push(child)
	};
}
