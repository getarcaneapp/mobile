import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

import { friendlyErrorMessage, isCancellation } from '@/core/errors';
import { boundedExec, type BoundedTerminalSession } from '@/core/networking/bounded-streams';
import {
	TerminalOutputFollowBehavior,
	TerminalOutputProcessor,
	type TerminalOutputLine
} from '@/core/terminal-output-processor';
import type { EnvironmentID } from '@/sdk/client/environment';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

export const terminalShells = ['/bin/sh', '/bin/bash', '/bin/zsh', '/bin/ash'] as const;

const flushIntervalMs = 50;

type PumpResult = { kind: 'finished' } | { kind: 'stale' } | { kind: 'failed'; message: string };

async function pumpTerminalOutput(
	terminal: BoundedTerminalSession,
	processor: TerminalOutputProcessor,
	publish: () => void,
	isCurrent: () => boolean
): Promise<PumpResult> {
	let lastFlush: number | undefined;
	let pendingTimer: ReturnType<typeof setTimeout> | undefined;
	try {
		for await (const chunk of terminal.output) {
			if (!isCurrent()) return { kind: 'stale' };
			const replies = processor.append(chunk);
			for (let i = 0; i < replies; i++) void terminal.send('\u001b[1;1R').catch(() => {});
			const now = Date.now();
			if (lastFlush === undefined || now - lastFlush >= flushIntervalMs) {
				publish();
				lastFlush = now;
			} else if (pendingTimer === undefined) {
				pendingTimer = setTimeout(() => {
					pendingTimer = undefined;
					if (isCurrent()) publish();
				}, flushIntervalMs);
			}
		}
	} catch (error) {
		if (!isCurrent() || isCancellation(error)) return { kind: 'stale' };
		return { kind: 'failed', message: friendlyErrorMessage(error) };
	}
	return { kind: 'finished' };
}

export function useContainerTerminal(environmentID: EnvironmentID, containerID: string) {
	const [outputLines, setOutputLines] = useState<TerminalOutputLine[]>([]);
	const [outputRevision, setOutputRevision] = useState(0);
	const [shell, setShell] = useState<string>('/bin/sh');
	const [connectError, setConnectError] = useState<string>();
	const [isConnecting, setIsConnecting] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const [processor] = useState(() => new TerminalOutputProcessor());
	const [follow] = useState(() => new TerminalOutputFollowBehavior());
	const session = useRef<BoundedTerminalSession | undefined>(undefined);
	const generation = useRef(0);
	const state = useRef({ isConnected, isConnecting });
	useLayoutEffect(() => {
		state.current = { isConnected, isConnecting };
	});

	const publish = useCallback(() => {
		setOutputLines(processor.lineSnapshot());
		setOutputRevision((r) => r + 1);
	}, [processor]);

	const teardown = useCallback(async () => {
		generation.current += 1;
		const current = session.current;
		session.current = undefined;
		setIsConnected(false);
		setIsConnecting(false);
		await current?.close();
	}, []);

	const consumeOutput = useCallback(
		async (terminal: BoundedTerminalSession, run: number) => {
			const isCurrent = () => run === generation.current;
			const ended = await pumpTerminalOutput(terminal, processor, publish, isCurrent);
			if (!isCurrent()) return;
			if (ended.kind === 'failed') setConnectError(`Disconnected: ${ended.message}`);
			if (ended.kind === 'stale') return;
			processor.finish();
			publish();
			setIsConnected(false);
		},
		[processor, publish]
	);

	const connect = useCallback(
		async (requestedShell?: string) => {
			const client = useClientManager.getState().client;
			if (!client) {
				setConnectError('Not connected to a server.');
				return;
			}
			if (!requestedShell && (state.current.isConnected || state.current.isConnecting)) return;
			state.current = { isConnected: false, isConnecting: true };
			setIsConnecting(true);
			setConnectError(undefined);
			const run = ++generation.current;
			try {
				const terminal = await boundedExec(client, {
					envID: environmentID,
					id: containerID,
					shell: requestedShell ?? shell
				});
				if (run !== generation.current) {
					await terminal.close();
					return;
				}
				processor.clear();
				setOutputLines([]);
				follow.resume();
				session.current = terminal;
				setIsConnected(true);
				setIsConnecting(false);
				void consumeOutput(terminal, run);
			} catch (error) {
				if (run !== generation.current) return;
				setConnectError(friendlyErrorMessage(error));
				setIsConnecting(false);
			}
		},
		[environmentID, containerID, shell, processor, follow, consumeOutput]
	);

	const connectOnMount = useEffectEvent(() => void connect());
	const teardownOnUnmount = useEffectEvent(() => void teardown());
	useEffect(() => {
		connectOnMount();
		return () => teardownOnUnmount();
	}, []);

	const send = (text: string) => {
		void session.current?.send(text).catch(() => {});
	};

	return {
		outputLines,
		outputRevision,
		shell,
		selectShell: (next: string) => {
			if (next === shell) return;
			setShell(next);
			void teardown().then(() => connect(next));
		},
		connectError,
		isConnecting,
		isConnected,
		follow,
		connect: () => void connect(),
		teardown,
		send,
		copyAllOutput: async () => {
			const text = processor.snapshot().fullText;
			if (text === '') return;
			await Clipboard.setStringAsync(text);
			showToast(Toasts.copied());
		},
		clearOutput: () => {
			processor.clear();
			setOutputLines([]);
			follow.resume();
			setOutputRevision((r) => r + 1);
		}
	};
}
