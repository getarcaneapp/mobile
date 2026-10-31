import { useStoredString } from '@/core/storage';
import { useClientManager } from '@/stores/client-manager';

import {
	availableWidgets,
	DashboardWidget,
	moveWidgetEntries,
	resolveDashboardLayout,
	setWidgetHidden,
	type DashboardWidgetEntry,
	type DashboardWidgetID
} from './dashboard-widgets';

export function useDashboardLayout() {
	const serverURL = useClientManager((s) => s.serverURL);
	const serverLayout = useClientManager((s) => s.currentUser?.preferences?.dashboardLayout);
	const supportsV3 = useClientManager((s) => s.apiGeneration === 'v3');
	const [stored, setStored] = useStoredString(DashboardWidget.preferenceKey(serverURL), '');

	const resolved = resolveDashboardLayout({
		stored: DashboardWidget.decode(stored),
		server: serverLayout
	});
	const entries = availableWidgets(resolved, supportsV3);
	const unavailable = resolved.filter((entry) => !entries.includes(entry));
	const save = (next: DashboardWidgetEntry[]) =>
		setStored(DashboardWidget.encode([...next, ...unavailable]));
	const visible = entries.filter((entry) => !entry.hidden);
	const hidden = entries.filter((entry) => entry.hidden);

	return {
		entries,
		visible,
		hidden,
		isCustomized: DashboardWidget.decode(stored) !== undefined,
		move: (sourceIndices: number[], destination: number) =>
			save([...moveWidgetEntries(visible, sourceIndices, destination), ...hidden]),
		moveBy: (id: DashboardWidgetID, delta: number) => {
			const index = visible.findIndex((entry) => entry.id === id);
			const target = index + delta;
			if (index < 0 || target < 0 || target >= visible.length) return;
			save([...moveWidgetEntries(visible, [index], delta > 0 ? target + 1 : target), ...hidden]);
		},
		hide: (ids: DashboardWidgetID[]) =>
			save(ids.reduce((next, id) => setWidgetHidden(next, id, true), entries)),
		show: (id: DashboardWidgetID) => save(setWidgetHidden(entries, id, false)),
		reset: () => setStored('')
	};
}

export type DashboardLayoutModel = ReturnType<typeof useDashboardLayout>;
