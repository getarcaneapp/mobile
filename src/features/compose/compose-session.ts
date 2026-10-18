import { useCallback, useEffect, useLayoutEffect } from 'react';
import { create } from 'zustand';

import { ComposeDocument } from './model/compose-document';

export type ComposeTransform =
	| { kind: 'attachments'; path: string[] }
	| { kind: 'item'; path: string[]; index: number; original: string };
export type ComposeBindingRef = { session: string; transforms?: ComposeTransform[] };
export type ComposeBinding = { text: string; setText: (text: string) => void };

export type ComposeMenuAction = {
	id: string;
	title: string;
	systemImage: string;
	disabled?: boolean;
	dividerBefore?: boolean;
	onPress: () => void;
};

type Session = { text: string; setText: (text: string) => void; menuActions?: ComposeMenuAction[] };

type ComposeSessionState = {
	sessions: Record<string, Session>;
	register: (
		id: string,
		text: string,
		setText: (text: string) => void,
		menuActions?: ComposeMenuAction[]
	) => void;
	update: (id: string, text: string) => void;
	remove: (id: string) => void;
};

export const useComposeSessionStore = create<ComposeSessionState>((set) => ({
	sessions: {},
	register: (id, text, setText, menuActions) =>
		set((state) => ({ sessions: { ...state.sessions, [id]: { text, setText, menuActions } } })),
	update: (id, text) =>
		set((state) => {
			const session = state.sessions[id];
			if (!session || session.text === text) return state;
			return { sessions: { ...state.sessions, [id]: { ...session, text } } };
		}),
	remove: (id) =>
		set((state) => {
			const next = { ...state.sessions };
			delete next[id];
			return { sessions: next };
		})
}));

let nextSession = 0;
export const makeSessionID = (prefix: string) =>
	`${prefix}-${Date.now().toString(36)}-${++nextSession}`;

export function syncComposeSession(
	id: string,
	text: string,
	setText: (text: string) => void,
	menuActions?: ComposeMenuAction[]
) {
	const state = useComposeSessionStore.getState();
	const existing = state.sessions[id];
	if (!existing || existing.setText !== setText || existing.menuActions !== menuActions)
		state.register(id, text, setText, menuActions);
	else if (existing.text !== text) state.update(id, text);
}

function ensureComposeSession(
	id: string,
	text: string,
	setText: (text: string) => void,
	menuActions?: ComposeMenuAction[]
) {
	const state = useComposeSessionStore.getState();
	if (!state.sessions[id]) state.register(id, text, setText, menuActions);
}

export function useComposeSessionHost(
	id: string,
	text: string,
	setText: (text: string) => void,
	menuActions?: ComposeMenuAction[]
) {
	ensureComposeSession(id, text, setText, menuActions);
	useLayoutEffect(() => {
		syncComposeSession(id, text, setText, menuActions);
	});
	useEffect(() => () => useComposeSessionStore.getState().remove(id), [id]);
}

export const useComposeMenuActions = (session: string) =>
	useComposeSessionStore((state) => state.sessions[session]?.menuActions);

function applyTransforms(text: string, transforms: readonly ComposeTransform[]): string {
	let result = text;
	for (const transform of transforms) {
		if (transform.kind === 'attachments') {
			try {
				result = ComposeDocument.parse(result).convertingNetworkAttachments(transform.path);
			} catch {}
		} else {
			const items = ComposeDocument.tryParse(result)?.items(transform.path);
			result = items?.[transform.index] ?? transform.original;
		}
	}
	return result;
}

function writeBack(base: string, transforms: readonly ComposeTransform[], value: string): string {
	if (transforms.length === 0) return value;
	const [first, ...rest] = transforms;
	const inner = applyTransforms(base, [first!]);
	const updatedInner = writeBack(inner, rest, value);
	if (first!.kind === 'attachments') return updatedInner;
	return ComposeDocument.parse(base).settingItem(updatedInner, first!.path, first!.index);
}

export function resolveBinding(ref: ComposeBindingRef): ComposeBinding {
	const session = useComposeSessionStore.getState().sessions[ref.session];
	const transforms = ref.transforms ?? [];
	const base = session?.text ?? '';
	return {
		text: applyTransforms(base, transforms),
		setText: (value: string) => {
			const current = useComposeSessionStore.getState().sessions[ref.session];
			if (!current) return;
			const next = writeBack(current.text, transforms, value);
			current.setText(next);
			useComposeSessionStore.getState().update(ref.session, next);
		}
	};
}

export function useComposeBinding(ref: ComposeBindingRef): ComposeBinding {
	const base = useComposeSessionStore((state) => state.sessions[ref.session]?.text ?? '');
	const key = JSON.stringify(ref);
	const setText = useCallback(
		(value: string) => resolveBinding(JSON.parse(key) as ComposeBindingRef).setText(value),
		[key]
	);
	return { text: applyTransforms(base, ref.transforms ?? []), setText };
}

export const withTransform = (
	ref: ComposeBindingRef,
	transform: ComposeTransform
): ComposeBindingRef => ({
	session: ref.session,
	transforms: [...(ref.transforms ?? []), transform]
});
