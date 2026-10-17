import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';
import { create } from 'zustand';

import { systemColors } from '@/theme/colors';

/** Which haptic a toast plays when it appears. */
export type HapticKind = 'none' | 'light' | 'success' | 'error';

export type ToastActivityState = 'running' | 'success' | 'failure' | 'cancelled';

const activityTint: Record<ToastActivityState, string | undefined> = {
	running: systemColors.blue,
	success: systemColors.green,
	failure: systemColors.red,
	cancelled: undefined // secondary label
};

/** Port of `Toast` in Toast.swift. */
export type Toast = {
	id: string;
	title: string;
	/** Seconds on screen before auto-dismiss (floored at 1). */
	duration: number;
	symbol?: string;
	/** Glyph color; undefined means primary label. */
	symbolTint?: string;
	actionTitle?: string;
	haptic: HapticKind;
	activityID?: string;
	/** Normalized 0...1. */
	activityProgress?: number;
	activityState?: ToastActivityState;
	isPersistent?: boolean;
	tapAction?: () => void;
	/** Optional trailing button. Returns true to dismiss the toast. */
	action?: () => boolean;
};

let nextID = 0;
const makeID = () => `toast-${Date.now()}-${nextID++}`;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

export const Toasts = {
	/** Neutral "copied to clipboard" confirmation. */
	copied: (title = 'Copied'): Toast => ({
		id: makeID(),
		title,
		duration: 2,
		symbol: 'doc.on.doc',
		haptic: 'light'
	}),
	/** Success confirmation — green check. */
	success: (title: string): Toast => ({
		id: makeID(),
		title,
		duration: 2.5,
		symbol: 'checkmark.circle.fill',
		symbolTint: systemColors.green,
		haptic: 'success'
	}),
	/** Failure notice — red triangle. Longer so a two-line message can be read. */
	error: (title: string): Toast => ({
		id: makeID(),
		title,
		duration: 5,
		symbol: 'exclamationmark.triangle.fill',
		symbolTint: systemColors.red,
		haptic: 'error'
	}),
	/** Neutral informational message. */
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

/** Port of `ToastPresenter`: one visible toast, with a 170 ms hand-off between toasts. */
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

export function showToast(toast: Toast) {
	clearTimer();
	pendingToast = undefined;
	if (useToastPresenter.getState().activeToast) {
		// Fade the current toast out first, then present the new one.
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
	if (pendingToast) {
		pendingToast = updated;
	} else {
		clearTimer();
		useToastPresenter.setState({ activeToast: updated });
	}
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

/**
 * Marks an activity toast finished, or presents an already-finished activity
 * as a short result toast when it was never shown running.
 */
export function finishActivityToast(
	id: string,
	title: string,
	state: ToastActivityState,
	progress?: number
) {
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
	clearTimer();
	pendingToast = undefined;
	useToastPresenter.setState({ activeToast: undefined });
}
