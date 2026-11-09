import type { DashboardWidgetLayout } from '@/sdk/models/user/User';

export type DashboardWidgetID =
	| 'healthy'
	| 'attentionCount'
	| 'updates'
	| 'risk'
	| 'reclaimableTotal'
	| 'environments'
	| 'usage'
	| 'busiest'
	| 'attention'
	| 'activity'
	| 'jobs'
	| 'reclaimable'
	| 'memory';

export type DashboardWidgetTint = 'teal' | 'orange' | 'green' | 'red' | 'gray' | 'blue' | 'purple';

type DashboardWidgetInfo = {
	title: string;
	systemImage: string;
	tint: DashboardWidgetTint;
	isStat: boolean;
	requiresV3: boolean;
};

export type DashboardWidgetEntry = { id: DashboardWidgetID; hidden: boolean };

export type StoredDashboardLayout = { order: DashboardWidgetID[]; hidden: DashboardWidgetID[] };

export type DashboardWidgetGroup =
	| { kind: 'stats'; key: string; ids: DashboardWidgetID[] }
	| { kind: 'panel'; key: string; id: DashboardWidgetID };

const mobileOnly: readonly DashboardWidgetID[] = ['usage', 'busiest'];

export const DashboardWidget = {
	preferenceKeyPrefix: 'arcane.dashboardWidgets.',

	allCases: [
		'healthy',
		'attentionCount',
		'updates',
		'risk',
		'reclaimableTotal',
		'environments',
		'usage',
		'busiest',
		'attention',
		'activity',
		'jobs',
		'reclaimable',
		'memory'
	] as DashboardWidgetID[],

	defaults: [
		{ id: 'healthy', hidden: false },
		{ id: 'attentionCount', hidden: false },
		{ id: 'updates', hidden: false },
		{ id: 'risk', hidden: false },
		{ id: 'environments', hidden: false },
		{ id: 'usage', hidden: false },
		{ id: 'busiest', hidden: false },
		{ id: 'attention', hidden: false },
		{ id: 'activity', hidden: false },
		{ id: 'reclaimable', hidden: false },
		{ id: 'jobs', hidden: false },
		{ id: 'memory', hidden: false },
		{ id: 'reclaimableTotal', hidden: true }
	] as DashboardWidgetEntry[],

	info: {
		healthy: {
			title: 'Healthy',
			systemImage: 'server.rack',
			tint: 'teal',
			isStat: true,
			requiresV3: false
		},
		attentionCount: {
			title: 'Needs Attention',
			systemImage: 'exclamationmark.triangle.fill',
			tint: 'orange',
			isStat: true,
			requiresV3: false
		},
		updates: {
			title: 'Updates',
			systemImage: 'arrow.triangle.2.circlepath',
			tint: 'green',
			isStat: true,
			requiresV3: false
		},
		risk: {
			title: 'Risk Score',
			systemImage: 'exclamationmark.shield.fill',
			tint: 'red',
			isStat: true,
			requiresV3: true
		},
		reclaimableTotal: {
			title: 'Reclaimable',
			systemImage: 'trash.fill',
			tint: 'gray',
			isStat: true,
			requiresV3: true
		},
		environments: {
			title: 'Environments',
			systemImage: 'square.stack.3d.up.fill',
			tint: 'blue',
			isStat: false,
			requiresV3: false
		},
		usage: {
			title: 'Usage',
			systemImage: 'chart.xyaxis.line',
			tint: 'blue',
			isStat: false,
			requiresV3: false
		},
		busiest: {
			title: 'Busiest Containers',
			systemImage: 'flame.fill',
			tint: 'orange',
			isStat: false,
			requiresV3: false
		},
		attention: {
			title: 'Needs Attention',
			systemImage: 'exclamationmark.bubble.fill',
			tint: 'orange',
			isStat: false,
			requiresV3: false
		},
		activity: {
			title: 'Recent Activity',
			systemImage: 'clock.arrow.circlepath',
			tint: 'purple',
			isStat: false,
			requiresV3: true
		},
		jobs: {
			title: 'Upcoming Jobs',
			systemImage: 'calendar.badge.clock',
			tint: 'blue',
			isStat: false,
			requiresV3: false
		},
		reclaimable: {
			title: 'Reclaimable Space',
			systemImage: 'externaldrive.fill.badge.minus',
			tint: 'gray',
			isStat: false,
			requiresV3: true
		},
		memory: {
			title: 'Top Memory',
			systemImage: 'memorychip.fill',
			tint: 'purple',
			isStat: false,
			requiresV3: false
		}
	} satisfies Record<DashboardWidgetID, DashboardWidgetInfo>,

	preferenceKey(serverURL: string): string {
		return `${DashboardWidget.preferenceKeyPrefix}${serverURL}`;
	},

	isKnown(this: void, value: string): value is DashboardWidgetID {
		return (DashboardWidget.allCases as string[]).includes(value);
	},

	decode(raw: string | undefined): StoredDashboardLayout | undefined {
		if (!raw) return undefined;
		try {
			const parsed = JSON.parse(raw) as { order?: unknown; hidden?: unknown };
			const ids = (value: unknown) =>
				Array.isArray(value)
					? [...new Set(value.filter((id): id is string => typeof id === 'string'))].filter(
							DashboardWidget.isKnown
						)
					: [];
			const order = ids(parsed.order);
			return order.length === 0 ? undefined : { order, hidden: ids(parsed.hidden) };
		} catch {
			return undefined;
		}
	},

	encode(entries: readonly DashboardWidgetEntry[]): string {
		return JSON.stringify({
			order: entries.map((entry) => entry.id),
			hidden: entries.filter((entry) => entry.hidden).map((entry) => entry.id)
		});
	}
} as const;

function withMissingDefaults(entries: DashboardWidgetEntry[]): DashboardWidgetEntry[] {
	const result = [...entries];
	DashboardWidget.defaults.forEach((fallback, index) => {
		if (result.some((entry) => entry.id === fallback.id)) return;
		const previous = DashboardWidget.defaults
			.slice(0, index)
			.reverse()
			.find((entry) => result.some((other) => other.id === entry.id));
		const at = previous ? result.findIndex((entry) => entry.id === previous.id) + 1 : 0;
		result.splice(at, 0, { ...fallback });
	});
	return [...result.filter((entry) => !entry.hidden), ...result.filter((entry) => entry.hidden)];
}

export function layoutFromServer(
	server: readonly DashboardWidgetLayout[] | undefined
): DashboardWidgetEntry[] | undefined {
	const known = (server ?? []).filter(
		(widget): widget is DashboardWidgetLayout & { id: DashboardWidgetID } =>
			DashboardWidget.isKnown(widget.id) && !mobileOnly.includes(widget.id)
	);
	if (known.length === 0) return undefined;
	const ordered = known
		.filter((widget, index) => known.findIndex((other) => other.id === widget.id) === index)
		.sort(
			(a, b) =>
				Number(a.hidden ?? false) - Number(b.hidden ?? false) ||
				(a.y ?? 0) - (b.y ?? 0) ||
				(a.x ?? 0) - (b.x ?? 0)
		)
		.map((widget) => ({ id: widget.id, hidden: widget.hidden ?? false }));
	return withMissingDefaults(ordered);
}

export function resolveDashboardLayout(input: {
	stored: StoredDashboardLayout | undefined;
	server: readonly DashboardWidgetLayout[] | undefined;
}): DashboardWidgetEntry[] {
	if (input.stored) {
		const hidden = new Set(input.stored.hidden);
		return withMissingDefaults(input.stored.order.map((id) => ({ id, hidden: hidden.has(id) })));
	}
	return layoutFromServer(input.server) ?? DashboardWidget.defaults.map((entry) => ({ ...entry }));
}

export function availableWidgets(
	entries: readonly DashboardWidgetEntry[],
	supportsV3: boolean
): DashboardWidgetEntry[] {
	return entries.filter((entry) => supportsV3 || !DashboardWidget.info[entry.id].requiresV3);
}

export function groupVisibleWidgets(
	entries: readonly DashboardWidgetEntry[]
): DashboardWidgetGroup[] {
	const groups: DashboardWidgetGroup[] = [];
	for (const { id, hidden } of entries) {
		if (hidden) continue;
		const last = groups[groups.length - 1];
		if (!DashboardWidget.info[id].isStat) groups.push({ kind: 'panel', key: id, id });
		else if (last?.kind === 'stats') {
			last.ids.push(id);
			last.key = last.ids.join('|');
		} else groups.push({ kind: 'stats', key: id, ids: [id] });
	}
	return groups;
}

export function moveWidgetEntries(
	entries: readonly DashboardWidgetEntry[],
	sourceIndices: readonly number[],
	destination: number
): DashboardWidgetEntry[] {
	const moving = sourceIndices
		.map((index) => entries[index])
		.filter((entry): entry is DashboardWidgetEntry => entry !== undefined);
	const remaining = entries.filter((_, index) => !sourceIndices.includes(index));
	const insertAt = destination - sourceIndices.filter((index) => index < destination).length;
	remaining.splice(insertAt, 0, ...moving);
	return remaining;
}

export function setWidgetHidden(
	entries: readonly DashboardWidgetEntry[],
	id: DashboardWidgetID,
	hidden: boolean
): DashboardWidgetEntry[] {
	const current = entries.find((entry) => entry.id === id);
	if (!current) return [...entries];
	const others = entries.filter((entry) => entry.id !== id);
	if (hidden) return [...others, { id, hidden: true }];
	const firstHidden = others.findIndex((entry) => entry.hidden);
	const at = firstHidden < 0 ? others.length : firstHidden;
	return [...others.slice(0, at), { id, hidden: false }, ...others.slice(at)];
}
