/** The platform-neutral model behind `DynamicResourceDetailView` (DynamicResourceViews.swift). */
import { useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import { useClientManager } from '@/stores/client-manager';

import {
	DynamicResource,
	escapedPathComponent,
	sendRequest,
	type BackendListAction
} from './dynamic-resource';
import {
	useDynamicResourceNavigation,
	useRoutePayload,
	type DynamicResourceDetailPayload
} from './dynamic-resource-routes';

export function useDynamicResourceDetail() {
	const nav = useDynamicResourceNavigation();
	const payload = useRoutePayload<DynamicResourceDetailPayload>();
	const [resource, setResource] = useState(payload?.resource);
	const [actionMessage, setActionMessage] = useState<string>();
	const [errorMessage, setErrorMessage] = useState<string>();

	const actions = payload?.actions ?? [];
	const edit = payload?.edit;
	const basePath = payload?.basePath;

	const run = async (action: BackendListAction) => {
		const client = useClientManager.getState().client;
		if (!client || !resource) return;
		const suffix = action.pathSuffix.replaceAll('{id}', escapedPathComponent(resource.id));
		const target = suffix.startsWith('/') ? (basePath ?? '') + suffix : suffix;
		try {
			await sendRequest(client, target, action.method);
			setActionMessage(`${action.title} completed`);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		}
	};

	const presentEdit = () => {
		if (!edit || !resource) return;
		nav.openForm({
			title: edit.title,
			fields: edit.fields,
			initial: resource,
			onSubmit: async (body) => {
				const client = useClientManager.getState().client;
				if (!client || basePath === undefined) return;
				const target = `${basePath}/${escapedPathComponent(resource.id)}`;
				const response = await sendRequest(client, target, edit.method, body);
				try {
					setResource(client.transport.decodeEnvelope(response, DynamicResource.decode));
				} catch {
					// A response without the updated resource keeps the current one.
				}
				setActionMessage('Saved');
				payload?.onChange();
			}
		});
	};

	return {
		title: payload?.title ?? '',
		resource,
		details: resource ? DynamicResource.sortedDetails(resource) : [],
		actions,
		actionMessage,
		errorMessage,
		showsMenu: actions.length > 0 || edit !== undefined,
		canEdit: edit !== undefined && basePath !== undefined,
		run,
		presentEdit
	};
}

export type DynamicResourceDetailModel = ReturnType<typeof useDynamicResourceDetail>;
