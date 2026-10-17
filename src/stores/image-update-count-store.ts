import { create } from 'zustand';

import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';

type Scope = { transport: object; userID: string };

const scopeFor = (
	client: ArcaneClient | undefined,
	userID: string | undefined
): Scope | undefined =>
	client ? { transport: client.transport, userID: userID ?? 'anon' } : undefined;

const sameScope = (a: Scope | undefined, b: Scope | undefined) =>
	a === b ||
	(a !== undefined && b !== undefined && a.transport === b.transport && a.userID === b.userID);

type ImageUpdateCountState = {
	scope: Scope | undefined;
	counts: Readonly<Record<string, number>>;
	authoritativeEnvironmentIDs: ReadonlySet<string>;

	count: (
		environmentID: string,
		client: ArcaneClient | undefined,
		userID: string | undefined
	) => number | undefined;
	total: (
		client: ArcaneClient | undefined,
		userID: string | undefined,
		environmentIDs: readonly EnvironmentID[]
	) => number | undefined;
	setCount: (
		count: number,
		environmentID: EnvironmentID,
		client: ArcaneClient | undefined,
		userID: string | undefined
	) => void;
	setCounts: (
		counts: Record<string, number>,
		client: ArcaneClient | undefined,
		userID: string | undefined
	) => void;
	setSummaryCounts: (
		counts: Record<string, number>,
		client: ArcaneClient | undefined,
		userID: string | undefined
	) => void;
	refreshCount: (
		environmentID: EnvironmentID,
		client: ArcaneClient | undefined,
		userID: string | undefined
	) => Promise<void>;
};

export const useImageUpdateCountStore = create<ImageUpdateCountState>((set, get) => {
	const prepare = (next: Scope) => {
		const state = get();
		if (sameScope(state.scope, next)) {
			return {
				counts: { ...state.counts },
				authoritative: new Set(state.authoritativeEnvironmentIDs)
			};
		}
		return { counts: {} as Record<string, number>, authoritative: new Set<string>() };
	};

	return {
		scope: undefined,
		counts: {},
		authoritativeEnvironmentIDs: new Set(),

		count: (environmentID, client, userID) => {
			if (!sameScope(get().scope, scopeFor(client, userID))) return undefined;
			return get().counts[environmentID];
		},

		total: (client, userID, environmentIDs) => {
			const state = get();
			if (!sameScope(state.scope, scopeFor(client, userID)) || environmentIDs.length === 0)
				return undefined;
			if (state.authoritativeEnvironmentIDs.size === 0) return undefined;
			let total = 0;
			for (const id of environmentIDs) {
				const count = state.counts[id];
				if (count === undefined) return undefined;
				total += count;
			}
			return total;
		},

		setCount: (count, environmentID, client, userID) => {
			const scope = scopeFor(client, userID);
			if (!scope) return;
			const { counts, authoritative } = prepare(scope);
			counts[environmentID] = count;
			authoritative.add(environmentID);
			set({ scope, counts, authoritativeEnvironmentIDs: authoritative });
		},

		setCounts: (newCounts, client, userID) => {
			const scope = scopeFor(client, userID);
			if (!scope) return;
			const { counts, authoritative } = prepare(scope);
			Object.assign(counts, newCounts);
			for (const id of Object.keys(newCounts)) authoritative.add(id);
			set({ scope, counts, authoritativeEnvironmentIDs: authoritative });
		},

		setSummaryCounts: (newCounts, client, userID) => {
			const scope = scopeFor(client, userID);
			if (!scope) return;
			const { counts, authoritative } = prepare(scope);
			for (const [id, count] of Object.entries(newCounts)) {
				if (!authoritative.has(id)) counts[id] = count;
			}
			set({ scope, counts, authoritativeEnvironmentIDs: authoritative });
		},

		refreshCount: async (environmentID, client, userID) => {
			if (!client) return;
			try {
				const summary = await client.images.updateSummary({ envID: environmentID });
				get().setCount(summary.imagesWithUpdates, environmentID, client, userID);
			} catch {}
		}
	};
});
