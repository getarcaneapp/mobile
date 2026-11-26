import { router, type Href } from 'expo-router';
import { AppState, Platform } from 'react-native';

import { containerDisplayName } from '@/features/containers/container-model';
import { useClientManager } from '@/stores/client-manager';
import { useEnvironmentsStore } from '@/stores/environments-store';

import { ArcaneWidgetBridge } from '../../../modules/arcane-widget-bridge';
import { redirectSystemPath } from '@/core/system-links';
import { shortcutToken } from './shortcut-actions';
import {
	catalogKey,
	shortcutCatalogFileName,
	shortcutCatalogSchemaVersion,
	spotlightItems,
	type ShortcutCatalogItem
} from './shortcut-links';

const refreshIntervalMs = 10 * 60_000;
const maximumEnvironments = 10;
const containerLimit = 500;
const projectLimit = 200;

let writtenKey: string | undefined;
let lastRefresh = 0;
let generation = 0;

async function environmentItems(
	environmentID: string,
	environmentName: string
): Promise<ShortcutCatalogItem[]> {
	const client = useClientManager.getState().client;
	if (!client) return [];
	const [containers, projects] = await Promise.allSettled([
		client.containers.list({ envID: environmentID, query: { start: 0, limit: containerLimit } }),
		client.projects.list({ envID: environmentID, query: { start: 0, limit: projectLimit } })
	]);
	const items: ShortcutCatalogItem[] = [];
	if (containers.status === 'fulfilled')
		for (const container of containers.value.data) {
			const name = containerDisplayName(container);
			items.push({ kind: 'container', id: name, name, environmentID, environmentName });
		}
	if (projects.status === 'fulfilled')
		for (const project of projects.value.data)
			items.push({
				kind: 'project',
				id: project.id,
				name: project.name,
				environmentID,
				environmentName
			});
	return items;
}

async function write(items: ShortcutCatalogItem[]) {
	const key = catalogKey(items);
	if (key === writtenKey) return;
	writtenKey = key;
	const catalog = {
		schemaVersion: shortcutCatalogSchemaVersion,
		token: items.length > 0 ? shortcutToken() : '',
		items
	};
	await Promise.allSettled([
		ArcaneWidgetBridge.writeSharedFile(shortcutCatalogFileName, JSON.stringify(catalog)),
		items.length > 0
			? ArcaneWidgetBridge.indexSpotlight(spotlightItems(items))
			: ArcaneWidgetBridge.clearSpotlight()
	]);
}

async function refresh(force: boolean) {
	const manager = useClientManager.getState();
	if (manager.authState !== 'authenticated' || manager.isDemoActive) return;
	const environments = useEnvironmentsStore.getState();
	if (!environments.hasLoaded) return;
	if (!force && Date.now() - lastRefresh < refreshIntervalMs) return;
	lastRefresh = Date.now();
	const current = ++generation;
	const targets = environments.enabledEnvironments().slice(0, maximumEnvironments);
	const results = await Promise.all(
		targets.map((environment) =>
			environmentItems(environment.id, environment.name ?? environment.id).catch(
				() => [] as ShortcutCatalogItem[]
			)
		)
	);
	if (current !== generation || useClientManager.getState().authState !== 'authenticated') return;
	await write(results.flat());
}

function clear() {
	generation++;
	lastRefresh = 0;
	void write([]);
}

function openLink(url: string) {
	const href = redirectSystemPath({ path: url, initial: false });
	if (href) router.navigate(href as Href);
}

export function startShortcutPublisher(): () => void {
	if (Platform.OS !== 'ios' || !ArcaneWidgetBridge.isLinked) return () => {};
	const unsubscribers = [
		useClientManager.subscribe((state, previous) => {
			if (state.serverURL !== previous.serverURL || state.isDemoActive !== previous.isDemoActive) {
				clear();
				return;
			}
			if (state.authState === previous.authState) return;
			if (state.authState === 'login' || state.authState === 'setup') clear();
			else if (state.authState === 'authenticated') void refresh(true);
		}),
		useEnvironmentsStore.subscribe((state, previous) => {
			if (
				state.hasLoaded !== previous.hasLoaded ||
				state.environmentCatalogRevision !== previous.environmentCatalogRevision
			)
				void refresh(true);
		}),
		ArcaneWidgetBridge.addLinkListener(openLink)
	];
	const appState = AppState.addEventListener('change', (state) => {
		if (state !== 'active') return;
		void refresh(false);
		const pending = ArcaneWidgetBridge.takePendingLink();
		if (pending) openLink(pending);
	});
	void refresh(true);
	const pending = ArcaneWidgetBridge.takePendingLink();
	if (pending) setTimeout(() => openLink(pending), 0);
	return () => {
		appState.remove();
		for (const unsubscribe of unsubscribers) unsubscribe();
	};
}
