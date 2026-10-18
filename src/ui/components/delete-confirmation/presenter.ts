import { useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { create } from 'zustand';

export type DeleteConfirmationAction = {
	title: string;
	role?: 'destructive' | null;
	tint?: string;
	action: () => void;
};

export type DeleteConfirmationConfig = {
	title: string;
	message?: string;
	icon?: string | null;
	actions: DeleteConfirmationAction[];
	cancelTitle?: string;
	dismissOnConfirm?: boolean;
};

export type DeleteConfirmationRequest = {
	id: string;
	hostID: string;
	config: DeleteConfirmationConfig;
	onConfirmDismiss: () => void;
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

export function clearDeleteConfirmation() {
	const onDismiss = useDeleteConfirmationPresenter.getState().request?.onDismiss;
	useDeleteConfirmationPresenter.setState({ request: undefined });
	onDismiss?.();
}

function useDismiss() {
	const navigation = useNavigation();
	return () => {
		if (navigation.canGoBack()) navigation.goBack();
	};
}

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

export function useDeleteConfirmation(
	isPresented: boolean,
	setIsPresented: (value: boolean) => void,
	config: DeleteConfirmationConfig,
	hostID: string = ROOT_CONFIRMATION_HOST
) {
	const dismiss = useDismiss();
	const latest = useRef({ config, setIsPresented, dismiss });
	useLayoutEffect(() => {
		latest.current = { config, setIsPresented, dismiss };
	});
	useEffect(() => {
		if (!isPresented) return;
		presentDeleteConfirmation(latest.current.config, {
			hostID,
			onConfirmDismiss: () => latest.current.dismiss(),
			onDismiss: () => latest.current.setIsPresented(false)
		});
	}, [isPresented, hostID]);
}

export function useItemDeleteConfirmation<Item>(
	item: Item | undefined,
	setItem: (value: Item | undefined) => void,
	config: (item: Item) => DeleteConfirmationConfig,
	hostID: string = ROOT_CONFIRMATION_HOST
) {
	const dismiss = useDismiss();
	const latest = useRef({ config, setItem, dismiss, item });
	useLayoutEffect(() => {
		latest.current = { config, setItem, dismiss, item };
	});
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
