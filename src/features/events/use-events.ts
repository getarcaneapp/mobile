import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { formattedISO8601 } from '@/core/date-formatting';
import { friendlyErrorMessage } from '@/core/errors';
import { parseArcaneDate } from '@/sdk/models/base/date';
import type { Event, EventSeverityCounts } from '@/sdk/models/event/Event';
import { Permission } from '@/sdk/models/role/Permission';
import type { JSONValue } from '@/sdk/types/json';
import { useClientManager } from '@/stores/client-manager';
import { systemColors } from '@/theme/colors';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import { useAppIsActive } from '@/features/containers/hooks';
import { screenCache, useTabRouter } from '@/features/networks/tab-routes';

import { EventsStore, type EventSeverityFilter } from './events-store';
import { relativeTimeFormat } from '@/core/relative-time';

export function severityIcon(severity: string) {
	switch (severity.toLowerCase()) {
		case 'critical':
		case 'fatal':
			return 'flame.fill';
		case 'error':
			return 'xmark.octagon.fill';
		case 'warning':
		case 'warn':
			return 'exclamationmark.triangle.fill';
		case 'success':
			return 'checkmark.circle.fill';
		case 'debug':
			return 'ladybug.fill';
		default:
			return 'info.circle.fill';
	}
}

export function severityTint(severity: string) {
	switch (severity.toLowerCase()) {
		case 'critical':
		case 'fatal':
			return systemColors.pink;
		case 'error':
			return systemColors.red;
		case 'warning':
		case 'warn':
			return systemColors.orange;
		case 'success':
			return systemColors.green;
		case 'debug':
			return systemColors.gray;
		default:
			return systemColors.blue;
	}
}

export const severityFilterTint: Record<EventSeverityFilter, string> = {
	info: systemColors.blue,
	success: systemColors.green,
	warning: systemColors.orange,
	error: systemColors.red
};

export const severityCount = (counts: EventSeverityCounts, severity: EventSeverityFilter) =>
	counts[severity];

export const capitalized = (value: string) =>
	value
		.toLowerCase()
		.replace(/(^|\s)(\S)/g, (_m, space: string, c: string) => space + c.toUpperCase());

export function metadataMap(event: Event): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(event.metadata ?? {})) {
		out[key] = metadataString(value);
	}
	return out;
}

function metadataString(value: JSONValue): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	if (value === null) return 'null';
	return JSON.stringify(value);
}

export function relativeNamed(value: string, now = Date.now()) {
	const date = parseArcaneDate(value);
	if (!date) return value;
	const seconds = Math.round((date.getTime() - now) / 1000);
	const format = relativeTimeFormat();
	const abs = Math.abs(seconds);
	if (abs < 60) return format.format(seconds, 'second');
	if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
	if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
	if (abs < 86400 * 7) return format.format(Math.round(seconds / 86400), 'day');
	if (abs < 86400 * 30) return format.format(Math.round(seconds / (86400 * 7)), 'week');
	if (abs < 86400 * 365) return format.format(Math.round(seconds / (86400 * 30)), 'month');
	return format.format(Math.round(seconds / (86400 * 365)), 'year');
}

export const formattedEventDate = (value: string) =>
	formattedISO8601(value, 'abbreviated', 'standard');

export const eventCacheKey = (id: string) => `event:${id}`;

export function useEvents() {
	const nav = useTabRouter();
	const client = useClientManager((s) => s.client);
	useClientManager((s) => s.accessGeneration);
	const storeRef = useRef<EventsStore | null>(null);
	storeRef.current ??= new EventsStore();
	const store = storeRef.current;
	const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
	const [isLive, setIsLive] = useState(true);
	const [pendingDeleteEvent, setPendingDeleteEvent] = useState<Event>();
	const loadedQueryKey = useRef<string | undefined>(undefined);
	const isActive = useAppIsActive();
	const [isFocused, setIsFocused] = useState(false);

	const queryKey = store.queryKey;
	const queryTaskKey = `${client ? 'client' : 'none'}|${queryKey}`;

	useEffect(() => {
		store.configure(client);
		const key = queryKey;
		if (loadedQueryKey.current === key) {
			void store.poll();
			return;
		}
		const delay = loadedQueryKey.current !== undefined ? 350 : 0;
		const timer = setTimeout(() => {
			loadedQueryKey.current = key;
			void store.reload(true);
		}, delay);
		return () => clearTimeout(timer);
	}, [store, client, queryKey]);

	useEffect(() => {
		store.configure(client);
		void store.loadSeverityCounts();
	}, [store, client]);

	useFocusEffect(
		useCallback(() => {
			setIsFocused(true);
			if (loadedQueryKey.current !== undefined && loadedQueryKey.current === store.queryKey)
				void store.poll();
			return () => setIsFocused(false);
		}, [store])
	);

	useEffect(() => {
		if (!isLive || !isActive || !isFocused) return;
		const timer = setInterval(() => {
			void (async () => {
				await store.poll();
				await store.loadSeverityCounts();
			})();
		}, 5000);
		return () => clearInterval(timer);
	}, [store, isLive, isActive, isFocused, queryTaskKey]);

	const canDeleteEvents = hasPermission(Permission.Events.delete, null);

	const deleteEvent = async (event: Event) => {
		try {
			await store.delete(event);
			showToast(Toasts.success('Event deleted'));
		} catch (error) {
			showToast(Toasts.error(friendlyErrorMessage(error)));
		}
	};

	useItemDeleteConfirmation(pendingDeleteEvent, setPendingDeleteEvent, (event) => ({
		title: 'Delete Event',
		message: `Delete “${event.title}” from the event history?`,
		icon: 'trash',
		actions: [{ title: 'Delete', action: () => void deleteEvent(event) }],
		dismissOnConfirm: false
	}));

	const copy = async (text: string, title: string) => {
		await Clipboard.setStringAsync(text);
		showToast(Toasts.copied(title));
	};

	return {
		store,
		snapshot,
		isLive,
		toggleLive: () => setIsLive((value) => !value),
		canDeleteEvents,
		setSearchText: (text: string) => store.setSearchText(text),
		refresh: async () => {
			await store.reload();
			await store.loadSeverityCounts();
		},
		copyTitle: (event: Event) => void copy(event.title, 'Title copied'),
		copyDescription: (event: Event) => void copy(event.description ?? '', 'Description copied'),
		requestDelete: (event: Event) => setPendingDeleteEvent(event),
		openDetail: (event: Event) => {
			screenCache.set(eventCacheKey(event.id), event);
			nav.push(`event/${encodeURIComponent(event.id)}`);
		},
		emptyTitle:
			snapshot.selectedSeverities.size === 0 && snapshot.searchText === ''
				? 'No Events'
				: 'No Matching Events'
	};
}

export type EventsModel = ReturnType<typeof useEvents>;
