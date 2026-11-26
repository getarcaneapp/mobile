import { useEffect, useState } from 'react';
import { useStore } from 'zustand';

import { useClientManager } from '@/stores/client-manager';

import type { DiagnosticsTab, LogLevelFilter } from './diagnostics-model';
import {
	createDiagnosticsStore,
	type DiagnosticsState,
	type DiagnosticsStore
} from './diagnostics-store';

export function useDiagnosticsValue<T>(
	store: DiagnosticsStore,
	selector: (state: DiagnosticsState) => T
): T {
	return useStore(store, selector);
}

export function useDiagnostics() {
	const [store] = useState(createDiagnosticsStore);
	const client = useClientManager((s) => s.client);
	const [tab, setTab] = useState<DiagnosticsTab>('overview');
	const [connection, setConnection] = useState(0);
	const [goroutineSearch, setGoroutineSearch] = useState('');
	const [logSearch, setLogSearch] = useState('');
	const [logLevel, setLogLevel] = useState<LogLevelFilter>('all');
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
	const isPaused = useStore(store, (s) => s.isPaused);

	useEffect(() => {
		if (!client) return;
		void connection;
		return store.getState().connectSnapshot(client);
	}, [client, store, connection]);

	useEffect(() => {
		if (!client || tab !== 'actors') return;
		void connection;
		return store.getState().connectActors(client);
	}, [client, store, tab, connection]);

	useEffect(() => {
		if (!client || tab !== 'logs') return;
		void connection;
		return store.getState().connectLogs(client);
	}, [client, store, tab, connection]);

	useEffect(() => {
		if (!client || tab !== 'goroutines') return;
		void connection;
		void store.getState().loadGoroutines(client);
	}, [client, store, tab, connection]);

	const refresh = async () => {
		store.getState().setPaused(false);
		setConnection((value) => value + 1);
	};

	return {
		store,
		tab,
		setTab,
		isPaused,
		togglePaused: () => store.getState().setPaused(!isPaused),
		refresh,
		goroutineSearch,
		setGoroutineSearch,
		logSearch,
		setLogSearch,
		logLevel,
		setLogLevel,
		clearLogs: () => store.getState().clearLogs(),
		expanded,
		toggleExpanded: (id: string) =>
			setExpanded((current) => {
				const next = new Set(current);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			})
	};
}

export type DiagnosticsModel = ReturnType<typeof useDiagnostics>;
