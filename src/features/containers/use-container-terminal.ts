/**
 * The ContainerTerminalView.swift model: one bounded exec session, output
 * decoded by `TerminalOutputProcessor` and published at most every 50 ms,
 * DSR (cursor position) replies, and follow-the-bottom state.
 */
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';

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

export function useContainerTerminal(environmentID: EnvironmentID, containerID: string) {
	const [outputLines, setOutputLines] = useState<TerminalOutputLine[]>([]);
	const [outputRevision, setOutputRevision] = useState(0);
	const [shell, setShell] = useState<string>('/bin/sh');
	const [connectError, setConnectError] = useState<string>();
	const [isConnecting, setIsConnecting] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const processor = useRef(new TerminalOutputProcessor()).current;
	const follow = useRef(new TerminalOutputFollowBehavior()).current;
	const session = useRef<BoundedTerminalSession | undefined>(undefined);
	const generation = useRef(0);
	const state = useRef({ isConnected, isConnecting });
	state.current = { isConnected, isConnecting };

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
			let lastFlush: number | undefined;
			let pendingTimer: ReturnType<typeof setTimeout> | undefined;
			const isCurrent = () => run === generation.current;
			try {
				for await (const chunk of terminal.output) {
					if (!isCurrent()) return;
					const replies = processor.append(chunk);
					for (let i = 0; i < replies; i++) void terminal.send('\u001b[1;1R').catch(() => {});
					const now = Date.now();
					if (lastFlush === undefined || now - lastFlush >= flushIntervalMs) {
						publish();
						lastFlush = now;
					} else if (pendingTimer === undefined) {
						// Swift flushes on the next chunk; a trailing timer keeps the tail of a burst visible too.
						pendingTimer = setTimeout(() => {
							pendingTimer = undefined;
							if (isCurrent()) publish();
						}, flushIntervalMs);
					}
				}
			} catch (error) {
				if (!isCurrent() || isCancellation(error)) return;
				setConnectError(`Disconnected: ${friendlyErrorMessage(error)}`);
			}
			if (!isCurrent()) return;
			processor.finish();
			publish();
			setIsConnected(false);
		},
		[processor, publish]
	);

	const connect = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) {
			setConnectError('Not connected to a server.');
			return;
		}
		if (state.current.isConnected || state.current.isConnecting) return;
		setIsConnecting(true);
		setConnectError(undefined);
		const run = ++generation.current;
		try {
			const terminal = await boundedExec(client, { envID: environmentID, id: containerID, shell });
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
	}, [environmentID, containerID, shell, processor, follow, consumeOutput]);

	useEffect(() => {
		void connect();
		return () => void teardown();
		// Connect once on appear; shell changes are only allowed while disconnected.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const send = (text: string) => {
		void session.current?.send(text).catch(() => {});
	};

	return {
		outputLines,
		outputRevision,
		shell,
		setShell,
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
