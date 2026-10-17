/**
 * Port of `DeleteConfirmationPresenter` + the `.deleteConfirmation(...)`
 * modifiers (DeleteConfirmation.swift): one app-wide request, rendered by the
 * matching `DeleteConfirmationHost`. Each host has an ID so a confirmation
 * raised inside a sheet renders inside that sheet (mount another host there).
 */
import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

/**
 * One actionable choice shown in addition to Cancel. Most callers pass one
 * (the destructive action); Projects passes two.
 */
export type DeleteConfirmationAction = {
	title: string;
	/** Defaults to destructive. `null` is a plain (accent) action. */
	role?: 'destructive' | null;
	/** Capsule fill hex. Defaults to red for destructive, the app accent otherwise. */
	tint?: string;
	action: () => void;
};

export type DeleteConfirmationConfig = {
	title: string;
	message?: string;
	/** SF Symbol shown above the title; `null` hides it. Defaults to `exclamationmark.triangle`. */
	icon?: string | null;
	actions: DeleteConfirmationAction[];
	cancelTitle?: string;
	/** Operations and draft edits can keep their presenting screen open. Defaults to true. */
	dismissOnConfirm?: boolean;
};

export type DeleteConfirmationRequest = {
	id: string;
	hostID: string;
	config: DeleteConfirmationConfig;
	/** Runs after a confirmed action when `dismissOnConfirm` (Swift: `dismiss()`). */
	onConfirmDismiss: () => void;
	/** Resets the source state once the card is gone so the trigger can fire again. */
	onDismiss: () => void;
};

export const ROOT_CONFIRMATION_HOST = 'root';

type PresenterState = { request?: DeleteConfirmationRequest };

export const useDeleteConfirmationPresenter = create<PresenterState>(() => ({}));

let nextID = 0;

export function presentDeleteConfirmation(
	config: DeleteConfirmationConfig,
	options: { hostID?: string; onConfirmDismiss?: () => void; onDismiss?: () => void } = {}
) {
	// Defensively retire anything already showing so no source stays stuck "on".
	useDeleteConfirmationPresenter.getState().request?.onDismiss();
	useDeleteConfirmationPresenter.setState({
		request: {
			id: `confirm-${Date.now()}-${nextID++}`,
			hostID: options.hostID ?? ROOT_CONFIRMATION_HOST,
			config,
			onConfirmDismiss: options.onConfirmDismiss ?? (() => {}),
			onDismiss: options.onDismiss ?? (() => {})
		}
	});
}

/** Called by the host once the card has animated out. */
export function clearDeleteConfirmation() {
	const onDismiss = useDeleteConfirmationPresenter.getState().request?.onDismiss;
	useDeleteConfirmationPresenter.setState({ request: undefined });
	onDismiss?.();
}

/** `dismiss()` for the presenting screen: pops or closes the sheet it's in. */
function useDismiss() {
	const navigation = useNavigation();
	return () => {
		if (navigation.canGoBack()) navigation.goBack();
	};
}

/** Bool-driven, single destructive action. Mirrors `.deleteConfirmation(isPresented:title:...)`. */
export function singleActionConfig({
	title,
	message,
	icon = 'exclamationmark.triangle',
	confirmTitle = 'Delete',
	confirmTint,
	dismissOnConfirm = true,
	onConfirm
}: {
	title: string;
	message?: string;
	icon?: string | null;
	confirmTitle?: string;
	confirmTint?: string;
	dismissOnConfirm?: boolean;
	onConfirm: () => void;
}): DeleteConfirmationConfig {
	return {
		title,
		message,
		icon,
		actions: [{ title: confirmTitle, tint: confirmTint, action: onConfirm }],
		dismissOnConfirm
	};
}

/**
 * Bool-driven confirmation. Presents when `isPresented` turns true and sets it
 * back to false once the card is gone.
 */
export function useDeleteConfirmation(
	isPresented: boolean,
	setIsPresented: (value: boolean) => void,
	config: DeleteConfirmationConfig,
	hostID: string = ROOT_CONFIRMATION_HOST
) {
	const dismiss = useDismiss();
	const latest = useRef({ config, setIsPresented, dismiss });
	latest.current = { config, setIsPresented, dismiss };
	useEffect(() => {
		if (!isPresented) return;
		presentDeleteConfirmation(latest.current.config, {
			hostID,
			onConfirmDismiss: () => latest.current.dismiss(),
			onDismiss: () => latest.current.setIsPresented(false)
		});
	}, [isPresented, hostID]);
}

/**
 * Item-driven confirmation. Mirrors `.deleteConfirmation(item:config:)`: drive
 * it from a `pending` value set by swipe / context-menu / row actions.
 */
export function useItemDeleteConfirmation<Item>(
	item: Item | undefined,
	setItem: (value: Item | undefined) => void,
	config: (item: Item) => DeleteConfirmationConfig,
	hostID: string = ROOT_CONFIRMATION_HOST
) {
	const dismiss = useDismiss();
	const latest = useRef({ config, setItem, dismiss, item });
	latest.current = { config, setItem, dismiss, item };
	const hasItem = item !== undefined;
	useEffect(() => {
		const value = latest.current.item;
		if (!hasItem || value === undefined) return;
		presentDeleteConfirmation(latest.current.config(value), {
			hostID,
			onConfirmDismiss: () => latest.current.dismiss(),
			onDismiss: () => latest.current.setItem(undefined)
		});
	}, [hasItem, hostID]);
}
