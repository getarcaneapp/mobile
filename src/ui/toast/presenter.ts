import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';
import { create } from 'zustand';

import { systemColors } from '@/theme/colors';

export type HapticKind = 'none' | 'light' | 'success' | 'error';

export type ToastActivityState = 'running' | 'success' | 'failure' | 'cancelled';

const activityTint: Record<ToastActivityState, string | undefined> = {
	running: systemColors.blue,
	success: systemColors.green,
	failure: systemColors.red,
	cancelled: undefined
};

export type Toast = {
	id: string;
	title: string;
	duration: number;
	symbol?: string;
	symbolTint?: string;
	actionTitle?: string;
	haptic: HapticKind;
	activityID?: string;
	activityProgress?: number;
	activityState?: ToastActivityState;
	isPersistent?: boolean;
	tapAction?: () => void;
	action?: () => boolean;
};

let nextID = 0;
const makeID = () => `toast-${Date.now()}-${nextID++}`;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

export const Toasts = {
	copied: (title = 'Copied'): Toast => ({
		id: makeID(),
		title,
		duration: 2,
		symbol: 'doc.on.doc',
		haptic: 'light'
	}),
	success: (title: string): Toast => ({
		id: makeID(),
		title,
		duration: 2.5,
		symbol: 'checkmark.circle.fill',
		symbolTint: systemColors.green,
		haptic: 'success'
	}),
	error: (title: string): Toast => ({
		id: makeID(),
		title,
		duration: 5,
		symbol: 'exclamationmark.triangle.fill',
		symbolTint: systemColors.red,
		haptic: 'error'
	}),
	info: (title: string): Toast => ({
		id: makeID(),
		title,
		duration: 2.5,
		symbol: 'info.circle',
		haptic: 'light'
	}),
	activity: (id: string, title: string, progress?: number, tapAction?: () => void): Toast => ({
		id: makeID(),
		title,
		duration: 2.5,
		symbol: 'clock.arrow.circlepath',
		symbolTint: systemColors.blue,
		haptic: 'light',
		activityID: id,
		activityProgress: progress,
		activityState: 'running',
		isPersistent: true,
		tapAction
	})
};

function playHaptic(kind: HapticKind) {
	if (Platform.OS === 'web') return;
	switch (kind) {
		case 'light':
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			break;
		case 'success':
			void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			break;
		case 'error':
			void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			break;
		case 'none':
			break;
	}
}

type ToastPresenterState = { activeToast?: Toast };

export const useToastPresenter = create<ToastPresenterState>(() => ({}));

let pendingToast: Toast | undefined;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

const currentToast = () => useToastPresenter.getState().activeToast ?? pendingToast;

function clearTimer() {
	if (dismissTimer) clearTimeout(dismissTimer);
	dismissTimer = undefined;
}

function scheduleDismiss(seconds: number) {
	clearTimer();
	dismissTimer = setTimeout(dismissToast, seconds * 1000);
}

function present(toast: Toast) {
	useToastPresenter.setState({ activeToast: toast });
	playHaptic(toast.haptic);
	AccessibilityInfo.announceForAccessibility(toast.title);
	if (!toast.isPersistent) scheduleDismiss(Math.max(toast.duration, 1));
}

const activityUpdateIntervalMs = 250;
let lastActivityUpdateAt = 0;
let queuedActivityUpdate: Toast | undefined;
let activityUpdateTimer: ReturnType<typeof setTimeout> | undefined;

function cancelQueuedActivityUpdate() {
	if (activityUpdateTimer) clearTimeout(activityUpdateTimer);
	activityUpdateTimer = undefined;
	queuedActivityUpdate = undefined;
}

function applyActivityUpdate(updated: Toast) {
	lastActivityUpdateAt = Date.now();
	if (pendingToast) {
		pendingToast = updated;
	} else {
		clearTimer();
		useToastPresenter.setState({ activeToast: updated });
	}
}

function flushQueuedActivityUpdate() {
	activityUpdateTimer = undefined;
	const queued = queuedActivityUpdate;
	queuedActivityUpdate = undefined;
	if (!queued || currentToast()?.activityID !== queued.activityID) return;
	applyActivityUpdate({ ...currentToast()!, ...activityFields(queued) });
}

function activityFields(toast: Toast): Partial<Toast> {
	return {
		title: toast.title,
		symbol: toast.symbol,
		symbolTint: toast.symbolTint,
		activityProgress: toast.activityProgress,
		activityState: toast.activityState,
		isPersistent: toast.isPersistent
	};
}

export function showToast(toast: Toast) {
	cancelQueuedActivityUpdate();
	clearTimer();
	pendingToast = undefined;
	if (useToastPresenter.getState().activeToast) {
		useToastPresenter.setState({ activeToast: undefined });
		pendingToast = toast;
		dismissTimer = setTimeout(() => {
			const next = pendingToast;
			pendingToast = undefined;
			if (next) present(next);
		}, 170);
	} else {
		present(toast);
	}
}

export function showActivityToast(
	id: string,
	title: string,
	progress?: number,
	tapAction?: () => void
) {
	const normalized = progress === undefined ? undefined : clamp(progress);
	const current = currentToast();
	if (!current || current.activityID !== id) {
		showToast(Toasts.activity(id, title, normalized, tapAction));
		return;
	}
	const updated: Toast = {
		...current,
		title,
		symbol: 'clock.arrow.circlepath',
		symbolTint: systemColors.blue,
		activityProgress: normalized,
		activityState: 'running',
		isPersistent: true
	};
	if (
		current.title === title &&
		current.activityProgress === normalized &&
		current.activityState === 'running' &&
		queuedActivityUpdate === undefined
	)
		return;
	const elapsed = Date.now() - lastActivityUpdateAt;
	if (elapsed >= activityUpdateIntervalMs && activityUpdateTimer === undefined) {
		applyActivityUpdate(updated);
		return;
	}
	queuedActivityUpdate = updated;
	activityUpdateTimer ??= setTimeout(
		flushQueuedActivityUpdate,
		Math.max(activityUpdateIntervalMs - elapsed, 0)
	);
}

const terminalTitle = (title: string, state: ToastActivityState) => {
	switch (state) {
		case 'running':
			return title;
		case 'success':
			return `${title} completed`;
		case 'failure':
			return `${title} failed`;
		case 'cancelled':
			return `${title} cancelled`;
	}
};

const terminalSymbol: Record<ToastActivityState, string> = {
	running: 'clock.arrow.circlepath',
	success: 'checkmark.circle.fill',
	failure: 'exclamationmark.triangle.fill',
	cancelled: 'slash.circle.fill'
};

export function finishActivityToast(
	id: string,
	title: string,
	state: ToastActivityState,
	progress?: number
) {
	cancelQueuedActivityUpdate();
	const current = currentToast();
	const updatesCurrent = current?.activityID === id;
	const base = updatesCurrent && current ? current : Toasts.activity(id, title, progress);
	const toast: Toast = {
		...base,
		title: terminalTitle(title, state),
		symbol: terminalSymbol[state],
		symbolTint: activityTint[state],
		activityProgress:
			state === 'success' ? 1 : progress === undefined ? undefined : clamp(progress),
		activityState: state,
		isPersistent: false,
		duration: state === 'failure' ? 5 : 2.5
	};
	if (!updatesCurrent) {
		showToast(toast);
		return;
	}
	if (pendingToast) {
		pendingToast = toast;
		return;
	}
	clearTimer();
	useToastPresenter.setState({ activeToast: toast });
	AccessibilityInfo.announceForAccessibility(toast.title);
	scheduleDismiss(toast.duration);
}

export function dismissToast() {
	cancelQueuedActivityUpdate();
	clearTimer();
	pendingToast = undefined;
	useToastPresenter.setState({ activeToast: undefined });
}
