import { AppState, Platform } from 'react-native';

import { LiveActivities } from '@/core/live-activities';
import { Keys, storage } from '@/core/storage';
import { useClientManager } from '@/stores/client-manager';
import { useDashboardStreamStore } from '@/stores/dashboard-stream-store';
import { useEnvironmentsStore } from '@/stores/environments-store';

import { ArcaneWidgetBridge } from '../../../modules/arcane-widget-bridge';
import {
	buildWidgetEnvironments,
	materialWidgetKey,
	signedOutWidgetSnapshot,
	widgetDate,
	widgetSnapshotSchemaVersion,
	type WidgetEnvironmentSummary,
	type WidgetSnapshot
} from './widget-snapshot';

const debounceMs = 6000;

let writtenKey: string | undefined;
let lastEnvironments: WidgetEnvironmentSummary[] = [];
let queued: WidgetSnapshot | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function write(snapshot: WidgetSnapshot) {
	const key = materialWidgetKey(snapshot);
	if (key === writtenKey) return;
	writtenKey = key;
	void ArcaneWidgetBridge.writeSnapshot(JSON.stringify(snapshot), true).catch(() => {
		if (writtenKey === key) writtenKey = undefined;
	});
}

function flush() {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = undefined;
	const snapshot = queued;
	queued = undefined;
	if (snapshot) write(snapshot);
}

function schedule(snapshot: WidgetSnapshot) {
	queued = snapshot;
	debounceTimer ??= setTimeout(flush, debounceMs);
}

function publishSignedOut() {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = undefined;
	queued = undefined;
	lastEnvironments = [];
	write(signedOutWidgetSnapshot(new Date()));
}

function currentSnapshot(): WidgetSnapshot | undefined {
	const manager = useClientManager.getState();
	const environments = useEnvironmentsStore.getState();
	if (!environments.hasLoaded) return undefined;
	const summaries = buildWidgetEnvironments({
		environments: environments.enabledEnvironments(),
		dashboardStates: useDashboardStreamStore.getState().statesByEnvironmentID,
		dockerInfo: environments.dockerInfoByEnvironmentID,
		unavailableEnvironmentIDs: environments.unavailableEnvironmentIDs,
		actionItems: environments.actionItems,
		previous: lastEnvironments
	});
	if (!summaries) return undefined;
	lastEnvironments = summaries;
	const accentHex = storage.string(Keys.accentColorHex)?.trim();
	return {
		schemaVersion: widgetSnapshotSchemaVersion,
		generatedAt: widgetDate(new Date()),
		serverConfigured: true,
		serverOrigin: manager.serverOrigin(),
		isDemo: manager.isDemoActive,
		accentHex: accentHex ? accentHex : undefined,
		activeEnvironmentID: manager.activeEnvironmentID,
		environments: summaries
	};
}

function refresh() {
	const authState = useClientManager.getState().authState;
	if (authState === 'setup') {
		publishSignedOut();
		return;
	}
	if (authState !== 'authenticated') return;
	const snapshot = currentSnapshot();
	if (snapshot) schedule(snapshot);
}

export function startWidgetPublisher(): () => void {
	if (Platform.OS !== 'ios' || !ArcaneWidgetBridge.isLinked) return () => {};
	LiveActivities.endAll();
	const unsubscribers = [
		useClientManager.subscribe((state, previous) => {
			if (state.authState !== previous.authState && state.authState !== 'authenticated')
				LiveActivities.endAll();
			if (
				(previous.authState === 'authenticated' && state.authState === 'login') ||
				(state.serverURL !== previous.serverURL && state.authState !== 'authenticated')
			) {
				publishSignedOut();
				return;
			}
			if (
				state.authState !== previous.authState ||
				state.serverURL !== previous.serverURL ||
				state.isDemoActive !== previous.isDemoActive ||
				state.activeEnvironmentID !== previous.activeEnvironmentID
			)
				refresh();
		}),
		useDashboardStreamStore.subscribe((state, previous) => {
			if (state.statesByEnvironmentID !== previous.statesByEnvironmentID) refresh();
		}),
		useEnvironmentsStore.subscribe((state, previous) => {
			if (
				state.hasLoaded !== previous.hasLoaded ||
				state.environmentCatalogRevision !== previous.environmentCatalogRevision ||
				state.dockerInformationRevision !== previous.dockerInformationRevision
			)
				refresh();
		}),
		storage.subscribe(Keys.accentColorHex, refresh)
	];
	const appState = AppState.addEventListener('change', (state) => {
		if (state !== 'active') flush();
	});
	refresh();
	return () => {
		appState.remove();
		for (const unsubscribe of unsubscribers) unsubscribe();
		flush();
	};
}
