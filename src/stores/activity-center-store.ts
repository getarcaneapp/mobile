import { createStore, useStore, type StoreApi } from 'zustand';
import { deepEqual } from '@/core/deep-equal';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import {
	PaginationLoader,
	ProgressivePaginationState,
	progressiveFanOut,
	type ResourcePage
} from '@/core/networking/pagination-loader';
import { RemoteDataLimits } from '@/core/networking/remote-data-limits';
import {
	ActivityCenterItem,
	ActivityDisplay,
	ActivityStatusFilter,
	activityItemKey,
	dateMs,
	retainingActiveActivities,
	sortedUnique
} from '@/features/activities/activity-display';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { ArcaneTransport } from '@/sdk/client/ArcaneTransport';
import { EnvironmentID } from '@/sdk/client/environment';
import type {
	Activity,
	ActivityDetail,
	ActivityMessage,
	ActivityStreamEvent
} from '@/sdk/models/activity/Activity';

const pageSize = 50;
const streamRebuildIntervalMs = 200;
const maxReconnectAttempts = 20;
const maxReconnectDelaySeconds = 15;
const stableConnectionSeconds = 5;
const idleRetrySeconds = 30;

export type ActivityHistoryClearResult = {
	deleted: number;
	failed: number;
	clearedEnvironmentIDs: ReadonlySet<string>;
};

type StreamWarning = 'loadPartial' | 'missed' | 'environmentFailure' | 'persistentFailure';

type ActivityEnvironment = { id: EnvironmentID; name: string };

type ActivitySource = { key: string; environments: ActivityEnvironment[] };

const defaultAggregateLimit = 64;

async function aggregateLimit(client: ArcaneClient): Promise<number> {
	const settings = await client.settings
		.getPublicSettings({ envID: EnvironmentID.localDocker })
		.catch(() => []);
	const value = Number(settings.find((setting) => setting.key === 'allEnvironmentsLimit')?.value);
	return Number.isFinite(value) && value >= 2 ? Math.floor(value) : defaultAggregateLimit;
}

async function activitySources(
	client: ArcaneClient,
	environments: ActivityEnvironment[]
): Promise<ActivitySource[]> {
	if ((await client.apiGeneration()) !== 'v3' || environments.length < 2) {
		return environments.map((environment) => ({
			key: environment.id,
			environments: [environment]
		}));
	}
	const limit = await aggregateLimit(client);
	const sources: ActivitySource[] = [];
	for (let start = 0; start < environments.length; start += limit) {
		const chunk = environments.slice(start, start + limit);
		sources.push({
			key: chunk.map((environment) => environment.id).join(','),
			environments: chunk
		});
	}
	return sources;
}

export type ActivityCenterState = {
	activities: Activity[];
	runningItems: ActivityCenterItem[];
	historyItems: ActivityCenterItem[];
	filteredActivityCount: number;
	availableTypes: string[];
	availableResourceTypes: string[];
	isLoading: boolean;
	isLoadingMore: boolean;
	isStreaming: boolean;
	hasMore: boolean;
	errorMessage: string | undefined;
	loadMoreError: string | undefined;
	streamErrorMessage: string | undefined;
	environmentIDs: string[];
	activityDetails: Readonly<Record<string, ActivityDetail>>;

	searchText: string;
	statusFilter: ActivityStatusFilter;
	typeFilter: string;
	resourceFilter: string;

	setSearchText: (value: string) => void;
	setStatusFilter: (value: ActivityStatusFilter) => void;
	setTypeFilter: (value: string) => void;
	setResourceFilter: (value: string) => void;

	configure: (client: ArcaneClient | undefined) => void;
	load: (options?: { reset?: boolean; refresh?: boolean }) => Promise<void>;
	loadMore: () => Promise<void>;
	detail: (activity: Activity) => ActivityDetail | undefined;
	loadDetail: (activity: Activity) => Promise<void>;
	startStream: () => void;
	retryLiveUpdates: () => Promise<void>;
	acquireStream: () => void;
	releaseStream: () => void;
	stopStream: () => void;
	cancel: (activity: Activity, requestedBy: string | undefined) => Promise<boolean>;
	clearHistory: (
		environmentIDs: ReadonlySet<string>
	) => Promise<ActivityHistoryClearResult | undefined>;
	removeClearedHistory: (environmentIDs: ReadonlySet<string>) => void;
};

export type ActivityCenterStore = StoreApi<ActivityCenterState>;

function sortActivities(items: readonly Activity[]): Activity[] {
	return [...items].sort((lhs, rhs) => {
		const lhsActive = ActivityDisplay.isCancellable(lhs);
		const rhsActive = ActivityDisplay.isCancellable(rhs);
		if (lhsActive !== rhsActive) return lhsActive ? -1 : 1;
		return ActivityDisplay.sortTime(rhs) - ActivityDisplay.sortTime(lhs);
	});
}

function sameActivity(a: Activity, b: Activity): boolean {
	return a === b || deepEqual(a, b);
}

function sameActivities(a: readonly Activity[], b: readonly Activity[]): boolean {
	if (a.length !== b.length) return false;
	for (let index = 0; index < a.length; index += 1) {
		const lhs = a[index];
		const rhs = b[index];
		if (!lhs || !rhs || !sameActivity(lhs, rhs)) return false;
	}
	return true;
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

function normalize(activity: Activity, environment: ActivityEnvironment): Activity {
	let normalized = activity;
	if ((activity.sourceEnvironmentID?.trim() ?? '') === '')
		normalized = { ...normalized, sourceEnvironmentID: environment.id };
	if ((activity.sourceEnvironmentName?.trim() ?? '') === '')
		normalized = { ...normalized, sourceEnvironmentName: environment.name };
	return normalized;
}

function calculateGroupedItems(filteredActivities: readonly Activity[]): ActivityCenterItem[] {
	const unbatched: Activity[] = [];
	const batches = new Map<string, Activity[]>();
	for (const activity of filteredActivities) {
		const batchID = activity.batchID?.trim() ?? '';
		if (batchID === '') {
			unbatched.push(activity);
		} else {
			const members = batches.get(batchID);
			if (members) members.push(activity);
			else batches.set(batchID, [activity]);
		}
	}
	const items: ActivityCenterItem[] = unbatched.map((activity) => ({ kind: 'activity', activity }));
	for (const [batchID, members] of batches) {
		const sortedMembers = [...members].sort(
			(a, b) => ActivityDisplay.sortTime(b) - ActivityDisplay.sortTime(a)
		);
		const only = sortedMembers[0];
		if (sortedMembers.length === 1 && only) {
			items.push({ kind: 'activity', activity: only });
		} else {
			items.push({ kind: 'batch', batch: { id: batchID, activities: sortedMembers } });
		}
	}
	return items.sort((a, b) => ActivityCenterItem.sortTime(b) - ActivityCenterItem.sortTime(a));
}

function containsSearch(value: string | undefined, search: string): boolean {
	return value !== undefined && value.toLocaleLowerCase().includes(search.toLocaleLowerCase());
}

function matchesSearch(activity: Activity, search: string): boolean {
	return (
		containsSearch(ActivityDisplay.displayTitle(activity), search) ||
		containsSearch(ActivityDisplay.subtitle(activity), search) ||
		containsSearch(activity.latestMessage, search) ||
		containsSearch(activity.type, search) ||
		containsSearch(activity.status, search) ||
		containsSearch(activity.sourceEnvironmentName, search)
	);
}

function insertMessage(
	message: ActivityMessage,
	messages: readonly ActivityMessage[]
): ActivityMessage[] {
	if (messages.some((existing) => existing.id === message.id)) return [...messages];
	const createdAt = dateMs(message.createdAt);
	let low = 0;
	let high = messages.length;
	while (low < high) {
		const mid = Math.trunc((low + high) / 2);
		const candidate = messages[mid];
		if (candidate && dateMs(candidate.createdAt) <= createdAt) low = mid + 1;
		else high = mid;
	}
	return [...messages.slice(0, low), message, ...messages.slice(low)];
}

const sleep = (seconds: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		if (signal.aborted) {
			resolve();
			return;
		}
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, seconds * 1000);
		const onAbort = () => {
			clearTimeout(timer);
			resolve();
		};
		signal.addEventListener('abort', onAbort, { once: true });
	});

export function createActivityCenterStore(): ActivityCenterStore {
	return createStore<ActivityCenterState>((set, get) => {
		let client: ArcaneClient | undefined;
		let clientTransportIdentity: ArcaneTransport | undefined;
		let paginationByEnvironment = new Map<string, ProgressivePaginationState>();
		let failedPageEnvironmentIDs = new Set<string>();
		let loadGeneration = 0;
		let activityBuckets = new Map<string, Activity[]>();
		let environmentNames = new Map<string, string>();
		let streamTask: AbortController | undefined;
		let failedStreamEnvironmentIDs = new Set<string>();
		let streamWarning: StreamWarning | undefined;
		let streamGeneration = 0;
		let streamConsumers = 0;
		let pendingStreamStop: ReturnType<typeof setTimeout> | undefined;
		let pendingRebuild: ReturnType<typeof setTimeout> | undefined;

		const filteredActivities = (): Activity[] => {
			const { activities, searchText, statusFilter, typeFilter, resourceFilter } = get();
			const trimmed = searchText.trim();
			return activities.filter(
				(activity) =>
					ActivityStatusFilter.matches(statusFilter, activity) &&
					(typeFilter === '' || activity.type === typeFilter) &&
					(resourceFilter === '' || activity.resourceType === resourceFilter) &&
					(trimmed === '' || matchesSearch(activity, trimmed))
			);
		};

		const recomputeGroupedItems = () => {
			const filtered = filteredActivities();
			const items = calculateGroupedItems(filtered);
			const running = items.filter(ActivityCenterItem.isActive);
			const history = items.filter((item) => !ActivityCenterItem.isActive(item));
			const state = get();
			const next: Partial<ActivityCenterState> = {};
			if (filtered.length !== state.filteredActivityCount)
				next.filteredActivityCount = filtered.length;
			if (!deepEqual(running, state.runningItems)) next.runningItems = running;
			if (!deepEqual(history, state.historyItems)) next.historyItems = history;
			if (Object.keys(next).length > 0) set(next);
		};

		const recomputeAvailableFilters = () => {
			const { activities, availableTypes, availableResourceTypes } = get();
			const nextTypes = sortedUnique(activities.map((activity) => activity.type));
			if (!sameStrings(nextTypes, availableTypes)) set({ availableTypes: nextTypes });
			const nextResourceTypes = sortedUnique(
				activities
					.map((activity) => activity.resourceType)
					.filter((value): value is string => value !== undefined)
			);
			if (!sameStrings(nextResourceTypes, availableResourceTypes))
				set({ availableResourceTypes: nextResourceTypes });
		};

		const rebuildActivities = () => {
			if (pendingRebuild !== undefined) clearTimeout(pendingRebuild);
			pendingRebuild = undefined;
			const next = sortActivities([...activityBuckets.values()].flat());
			if (sameActivities(next, get().activities)) return;
			set({ activities: next });
			recomputeAvailableFilters();
			recomputeGroupedItems();
		};

		const scheduleRebuild = () => {
			if (pendingRebuild !== undefined) return;
			pendingRebuild = setTimeout(() => {
				pendingRebuild = undefined;
				rebuildActivities();
			}, streamRebuildIntervalMs);
		};

		const environmentFor = (id: EnvironmentID): ActivityEnvironment => ({
			id,
			name: environmentNames.get(id) ?? id
		});

		const setDetailActivity = (activity: Activity) => {
			const key = activityItemKey(activity);
			const detail = get().activityDetails[key];
			if (!detail) return;
			set({ activityDetails: { ...get().activityDetails, [key]: { ...detail, activity } } });
		};

		const upsert = (activity: Activity, coalesced = false) => {
			setDetailActivity(activity);
			const environmentID = ActivityDisplay.sourceEnvironmentKey(activity);
			const bucket = [...(activityBuckets.get(environmentID) ?? [])];
			const windowSize = Math.max(pageSize, bucket.length);
			const index = bucket.findIndex((existing) => existing.id === activity.id);
			if (index >= 0) bucket[index] = activity;
			else bucket.unshift(activity);
			activityBuckets.set(environmentID, sortActivities(bucket).slice(0, windowSize));
			if (coalesced) scheduleRebuild();
			else rebuildActivities();
		};

		const clearStreamWarning = () => {
			streamWarning = undefined;
			failedStreamEnvironmentIDs = new Set();
			if (get().streamErrorMessage !== undefined) set({ streamErrorMessage: undefined });
		};

		const setStreamWarning = (warning: StreamWarning) => {
			streamWarning = warning;
			switch (warning) {
				case 'loadPartial':
					set({ streamErrorMessage: 'Some environments could not load. Pull to refresh.' });
					break;
				case 'missed':
					set({ streamErrorMessage: 'Some activity updates were missed. Pull to refresh.' });
					break;
				case 'environmentFailure':
					set({ streamErrorMessage: 'Some environments could not provide live activity updates.' });
					break;
				case 'persistentFailure':
					set({ streamErrorMessage: 'Live updates paused. Pull to refresh.' });
					break;
			}
		};

		const markStreamConnected = () => {
			if (streamWarning === 'persistentFailure') clearStreamWarning();
		};

		const markEnvironmentStreamConnected = (environmentID: string) => {
			failedStreamEnvironmentIDs.delete(environmentID);
			if (failedStreamEnvironmentIDs.size === 0 && streamWarning === 'environmentFailure')
				clearStreamWarning();
		};

		const markStreamFailed = () => {
			streamWarning = 'persistentFailure';
			set({ streamErrorMessage: 'Live updates paused. Pull to refresh.' });
		};

		const replaceSnapshot = (snapshot: readonly Activity[], environment: ActivityEnvironment) => {
			const normalized = snapshot.map((activity) => normalize(activity, environment));
			for (const activity of normalized) setDetailActivity(activity);
			const current = activityBuckets.get(environment.id) ?? [];
			const recentIDs = new Set(normalized.map((activity) => activity.id));
			const retained = current.filter((activity) => !recentIDs.has(activity.id));
			activityBuckets.set(
				environment.id,
				sortActivities([...normalized, ...retained]).slice(0, Math.max(pageSize, current.length))
			);
			scheduleRebuild();
		};

		const applyMessage = (message: ActivityMessage, environmentID: string | undefined) => {
			for (const [key, bucket] of activityBuckets) {
				if (environmentID !== undefined && environmentID !== key) continue;
				const index = bucket.findIndex((activity) => activity.id === message.activityID);
				const found = bucket[index];
				if (index < 0 || !found) continue;
				const next = [...bucket];
				next[index] = { ...found, latestMessage: message.message, updatedAt: message.createdAt };
				activityBuckets.set(key, next);
				break;
			}
			let details = get().activityDetails;
			for (const [key, detail] of Object.entries(details)) {
				if (
					detail.activity.id !== message.activityID ||
					(environmentID !== undefined &&
						environmentID !== ActivityDisplay.sourceEnvironmentKey(detail.activity))
				) {
					continue;
				}
				details = {
					...details,
					[key]: {
						activity: {
							...detail.activity,
							latestMessage: message.message,
							updatedAt: message.createdAt
						},
						messages: insertMessage(message, detail.messages)
					}
				};
			}
			if (details !== get().activityDetails) set({ activityDetails: details });
			scheduleRebuild();
		};

		const apply = (event: ActivityStreamEvent) => {
			switch (event.type) {
				case 'snapshot': {
					const environmentID = event.environmentID;
					if (environmentID === undefined) return;
					replaceSnapshot(event.activities, environmentFor(environmentID));
					markEnvironmentStreamConnected(environmentID);
					return;
				}
				case 'activity': {
					const activity = event.activity;
					if (!activity) return;
					const environmentID =
						event.environmentID ?? ActivityDisplay.sourceEnvironmentKey(activity);
					upsert(normalize(activity, environmentFor(environmentID)), true);
					return;
				}
				case 'message':
					if (event.message) applyMessage(event.message, event.environmentID);
					return;
				case 'missed':
					setStreamWarning('missed');
					return;
				case 'error': {
					const environmentID = event.environmentID;
					if (environmentID === undefined) return;
					failedStreamEnvironmentIDs.add(environmentID);
					setStreamWarning('environmentFailure');
					return;
				}
				default:
					return;
			}
		};

		const consumeStream = async (
			streamClient: ArcaneClient,
			generation: number,
			controller: AbortController
		) => {
			const signal = controller.signal;
			const scoped = streamClient.withSignal(signal);
			try {
				let attempt = 0;
				while (!signal.aborted && generation === streamGeneration) {
					const connectedAt = Date.now();
					let receivedFirstEvent = false;
					try {
						for await (const event of scoped.activities.stream({ limit: pageSize })) {
							if (generation !== streamGeneration || signal.aborted) return;
							if (!receivedFirstEvent) {
								receivedFirstEvent = true;
								markStreamConnected();
							}
							apply(event);
						}
					} catch (error) {
						if (isCancellation(error) || signal.aborted) return;
					}

					if (generation !== streamGeneration || signal.aborted) return;

					if (receivedFirstEvent && Date.now() - connectedAt >= stableConnectionSeconds * 1000)
						attempt = 0;
					let delay: number;
					if (attempt >= maxReconnectAttempts) {
						markStreamFailed();
						delay = idleRetrySeconds;
					} else {
						delay = Math.min(2 ** attempt, maxReconnectDelaySeconds);
						attempt += 1;
					}
					await sleep(delay, signal);
				}
			} finally {
				if (generation === streamGeneration) {
					streamTask = undefined;
					set({ isStreaming: false });
				}
			}
		};

		const resolveEnvironments = async (
			activeClient: ArcaneClient
		): Promise<ActivityEnvironment[]> => {
			const items = await PaginationLoader.collect(
				async (start, limit) => {
					const response = await activeClient.environments.list({
						query: { start, limit, sortBy: 'name', sortOrder: 'asc' }
					});
					return { items: response.data, pagination: response.pagination };
				},
				{ maximumItems: RemoteDataLimits.maximumEnvironments }
			);
			return items.map((environment) => {
				const name = environment.name?.trim() ?? '';
				return { id: environment.id, name: name === '' ? environment.id : name };
			});
		};

		const store: ActivityCenterState = {
			activities: [],
			runningItems: [],
			historyItems: [],
			filteredActivityCount: 0,
			availableTypes: [],
			availableResourceTypes: [],
			isLoading: false,
			isLoadingMore: false,
			isStreaming: false,
			hasMore: false,
			errorMessage: undefined,
			loadMoreError: undefined,
			streamErrorMessage: undefined,
			environmentIDs: [],
			activityDetails: {},

			searchText: '',
			statusFilter: 'all',
			typeFilter: '',
			resourceFilter: '',

			setSearchText: (value) => {
				if (value === get().searchText) return;
				set({ searchText: value });
				recomputeGroupedItems();
			},
			setStatusFilter: (value) => {
				set({ statusFilter: value });
				recomputeGroupedItems();
			},
			setTypeFilter: (value) => {
				set({ typeFilter: value });
				recomputeGroupedItems();
			},
			setResourceFilter: (value) => {
				set({ resourceFilter: value });
				recomputeGroupedItems();
			},

			configure: (next) => {
				const nextIdentity = next?.transport;
				const changed = nextIdentity !== clientTransportIdentity;
				client = next;
				if (!changed) return;
				clientTransportIdentity = nextIdentity;
				get().stopStream();
				if (pendingRebuild !== undefined) clearTimeout(pendingRebuild);
				pendingRebuild = undefined;
				activityBuckets = new Map();
				environmentNames = new Map();
				loadGeneration += 1;
				paginationByEnvironment = new Map();
				failedPageEnvironmentIDs = new Set();
				set({
					activities: [],
					activityDetails: {},
					environmentIDs: [],
					isLoading: false,
					isLoadingMore: false,
					hasMore: false,
					errorMessage: undefined,
					loadMoreError: undefined
				});
				clearStreamWarning();
				recomputeAvailableFilters();
				recomputeGroupedItems();
			},

			load: async ({ reset = true, refresh = false } = {}) => {
				const activeClient = client;
				if (!activeClient) return;
				loadGeneration += 1;
				const generation = loadGeneration;
				if (reset) {
					paginationByEnvironment = new Map();
					failedPageEnvironmentIDs = new Set();
					set({ isLoadingMore: false, loadMoreError: undefined, hasMore: false });
				}
				if (get().activities.length === 0 || refresh) set({ isLoading: true });
				set({ errorMessage: undefined });
				try {
					let environments: ActivityEnvironment[];
					try {
						environments = await resolveEnvironments(activeClient);
					} catch (error) {
						if (loadGeneration !== generation) return;
						if (reset) set({ errorMessage: friendlyErrorMessage(error) });
						else set({ loadMoreError: friendlyErrorMessage(error) });
						return;
					}
					if (loadGeneration !== generation) return;
					const environmentIDs = environments.map((environment) => environment.id);
					set({ environmentIDs });
					environmentNames = new Map();
					for (const environment of environments) {
						if (!environmentNames.has(environment.id))
							environmentNames.set(environment.id, environment.name);
					}
					const sources = await activitySources(activeClient, environments);
					if (loadGeneration !== generation) return;
					const requests: [ActivitySource, number][] = [];
					for (const source of sources) {
						const key = source.key;
						if (!paginationByEnvironment.has(key)) {
							paginationByEnvironment.set(
								key,
								ProgressivePaginationState.reset(ProgressivePaginationState.initial)
							);
							failedPageEnvironmentIDs.add(key);
						}
						if (
							!(
								reset ||
								paginationByEnvironment.get(key)?.hasMore === true ||
								failedPageEnvironmentIDs.has(key)
							)
						)
							continue;
						requests.push([source, paginationByEnvironment.get(key)?.nextStart ?? 0]);
					}
					let failures = 0;
					await progressiveFanOut(
						requests,
						async ([source, start]): Promise<
							[ActivitySource, number, ResourcePage<Activity> | undefined, number]
						> => {
							try {
								const response = await activeClient.activities.listPaginated({
									envID: source.key,
									order: 'desc',
									start,
									limit: pageSize
								});
								return [
									source,
									start,
									{ items: response.data, pagination: response.pagination },
									response.failedEnvironments?.length ?? 0
								];
							} catch {
								return [source, start, undefined, 0];
							}
						},
						(batch) => {
							if (loadGeneration !== generation) return;
							for (const [source, start, page, failedEnvironments] of batch) {
								const key = source.key;
								if (!page) {
									failures += 1;
									failedPageEnvironmentIDs.add(key);
									continue;
								}
								failures += failedEnvironments;
								failedPageEnvironmentIDs.delete(key);
								const state =
									paginationByEnvironment.get(key) ?? ProgressivePaginationState.initial;
								const received = ProgressivePaginationState.receive(state, {
									pagination: page.pagination,
									itemCount: page.items.length,
									requestedStart: start,
									requestedLimit: pageSize,
									generation: state.generation
								});
								paginationByEnvironment.set(key, received ?? state);
								const grouped = new Map<string, Activity[]>(
									source.environments.map((environment) => [environment.id, []])
								);
								for (const activity of page.items) {
									const environment =
										source.environments.length === 1 && source.environments[0]
											? source.environments[0]
											: environmentFor(activity.environmentID);
									const normalized = normalize(activity, environment);
									const id =
										source.environments.length === 1 ? environment.id : activity.environmentID;
									grouped.set(id, [...(grouped.get(id) ?? []), normalized]);
								}
								for (const [id, items] of grouped) {
									activityBuckets.set(
										id,
										sortActivities(
											PaginationLoader.merge(
												items,
												reset ? [] : (activityBuckets.get(id) ?? []),
												false
											)
										)
									);
								}
							}
							rebuildActivities();
							if (get().activities.length > 0) set({ isLoading: false });
						}
					);
					if (loadGeneration !== generation) return;
					const validEnvironmentIDs = new Set(environmentIDs);
					const validSourceKeys = new Set(sources.map((source) => source.key));
					activityBuckets = new Map(
						[...activityBuckets].filter(([key]) => validEnvironmentIDs.has(key))
					);
					paginationByEnvironment = new Map(
						[...paginationByEnvironment].filter(([key]) => validSourceKeys.has(key))
					);
					failedPageEnvironmentIDs = new Set(
						[...failedPageEnvironmentIDs].filter((key) => validSourceKeys.has(key))
					);
					set({
						hasMore:
							[...paginationByEnvironment.values()].some((state) => state.hasMore) ||
							failedPageEnvironmentIDs.size > 0
					});
					rebuildActivities();
					if (failures > 0) {
						if (reset) setStreamWarning('loadPartial');
						else set({ loadMoreError: "Couldn't load more activities. Try again." });
					}
				} finally {
					if (loadGeneration === generation) set({ isLoading: false });
				}
			},

			loadMore: async () => {
				const { isLoading, isLoadingMore, hasMore } = get();
				if (isLoading || isLoadingMore || !hasMore) return;
				set({ isLoadingMore: true, loadMoreError: undefined });
				const generation = loadGeneration + 1;
				try {
					await get().load({ reset: false });
				} finally {
					if (loadGeneration === generation) set({ isLoadingMore: false });
				}
			},

			detail: (activity) => get().activityDetails[activityItemKey(activity)],

			loadDetail: async (activity) => {
				const activeClient = client;
				if (!activeClient) return;
				const key = activityItemKey(activity);
				if (!get().activityDetails[key]) {
					set({ activityDetails: { ...get().activityDetails, [key]: { activity, messages: [] } } });
				}
				const previousActivity = get().activityDetails[key]?.activity;
				const identity = clientTransportIdentity;
				const environmentID = ActivityDisplay.sourceEnvironmentKey(activity);
				const response = await activeClient.activities.detail({
					envID: environmentID,
					activityID: activity.id,
					limit: 500
				});
				if (identity !== clientTransportIdentity) return;
				const environment = environmentFor(environmentID);
				let current: ActivityDetail = get().activityDetails[key] ?? response;
				if (
					current.activity === previousActivity &&
					ActivityDisplay.sortTime(response.activity) >= ActivityDisplay.sortTime(current.activity)
				) {
					current = { ...current, activity: normalize(response.activity, environment) };
					set({ activityDetails: { ...get().activityDetails, [key]: current } });
					upsert(current.activity);
					current = get().activityDetails[key] ?? current;
				}
				const messages = PaginationLoader.merge(current.messages, response.messages, false).sort(
					(a, b) => dateMs(a.createdAt) - dateMs(b.createdAt)
				);
				set({ activityDetails: { ...get().activityDetails, [key]: { ...current, messages } } });
			},

			startStream: () => {
				const activeClient = client;
				if (!activeClient) return;
				get().stopStream();
				clearStreamWarning();
				set({ isStreaming: true });
				streamGeneration += 1;
				const generation = streamGeneration;
				const controller = new AbortController();
				streamTask = controller;
				void consumeStream(activeClient, generation, controller);
			},

			retryLiveUpdates: async () => {
				get().stopStream();
				clearStreamWarning();
				await get().load({ refresh: true });
				get().startStream();
			},

			acquireStream: () => {
				streamConsumers += 1;
				if (pendingStreamStop !== undefined) clearTimeout(pendingStreamStop);
				pendingStreamStop = undefined;
				if (streamTask === undefined) get().startStream();
			},

			releaseStream: () => {
				streamConsumers = Math.max(0, streamConsumers - 1);
				if (streamConsumers !== 0) return;
				if (pendingStreamStop !== undefined) clearTimeout(pendingStreamStop);
				pendingStreamStop = setTimeout(() => {
					pendingStreamStop = undefined;
					if (streamConsumers === 0) get().stopStream();
				}, 1000);
			},

			stopStream: () => {
				streamGeneration += 1;
				streamTask?.abort();
				streamTask = undefined;
				if (get().isStreaming) set({ isStreaming: false });
			},

			cancel: async (activity, requestedBy) => {
				const activeClient = client;
				if (!activeClient) return false;
				const envID = ActivityDisplay.sourceEnvironmentKey(activity);
				const identity = clientTransportIdentity;
				try {
					const updated = await activeClient.activities.cancel({
						envID,
						activityID: activity.id,
						requestedBy
					});
					if (identity !== clientTransportIdentity) return false;
					upsert(normalize(updated, environmentFor(envID)));
					return true;
				} catch (error) {
					if (identity !== clientTransportIdentity) return false;
					set({ errorMessage: friendlyErrorMessage(error) });
					return false;
				}
			},

			clearHistory: async (allowedEnvironmentIDs) => {
				const activeClient = client;
				if (!activeClient) return undefined;
				const identity = clientTransportIdentity;
				const targets = get().environmentIDs.filter((id) => allowedEnvironmentIDs.has(id));
				if (targets.length === 0) return undefined;

				let deleted = 0;
				let failed = 0;
				const clearedEnvironmentIDs = new Set<string>();
				const results = await Promise.all(
					targets.map(async (id): Promise<[string, number | undefined]> => {
						try {
							const result = await activeClient.activities.clearHistory({ envID: id });
							return [id, result.deleted];
						} catch {
							return [id, undefined];
						}
					})
				);
				for (const [environmentID, count] of results) {
					if (count !== undefined) {
						deleted += count;
						clearedEnvironmentIDs.add(environmentID);
					} else {
						failed += 1;
					}
				}

				if (identity !== clientTransportIdentity) return undefined;
				get().removeClearedHistory(clearedEnvironmentIDs);
				return { deleted, failed, clearedEnvironmentIDs };
			},

			removeClearedHistory: (environmentIDs) => {
				if (environmentIDs.size === 0) return;
				for (const [environmentID, bucket] of activityBuckets) {
					if (!environmentIDs.has(environmentID)) continue;
					activityBuckets.set(environmentID, retainingActiveActivities(bucket, environmentIDs));
				}
				rebuildActivities();
			}
		};
		return store;
	});
}

export function useActivityCenter<T>(
	store: ActivityCenterStore,
	selector: (state: ActivityCenterState) => T
): T {
	return useStore(store, selector);
}
