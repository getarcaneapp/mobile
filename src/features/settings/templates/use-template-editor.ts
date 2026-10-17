import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { boundedAPIResponse, RemoteDataLimits } from '@/core/networking/remote-data-limits';
import { escapedPathComponent } from '@/core/networking/server-identity';
import { Permission } from '@/sdk/models/role/Permission';
import type { TemplateContent } from '@/sdk/models/template/Template';
import { useClientManager } from '@/stores/client-manager';
import { useDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { showToast, Toasts } from '@/ui/toast';

import {
	useRoutePayload,
	type TemplateEditorMode,
	type TemplateEditorPayload
} from './template-routes';

export const templateEditorConfirmationHost = 'template-editor';

type Fields = { name: string; description: string; compose: string; environment: string };
const emptyFields: Fields = { name: '', description: '', compose: '', environment: '' };

const utf8Length = (text: string) => new TextEncoder().encode(text).byteLength;

export function useTemplateEditor() {
	const { payload } = useRoutePayload<TemplateEditorPayload>();
	const [mode] = useState<TemplateEditorMode>(() => payload?.mode ?? { kind: 'create' });
	const router = useRouter();
	const client = useClientManager((s) => s.client);
	const cacheSessionIdentity = useClientManager((s) => s.cacheSessionIdentity);
	useClientManager((s) => s.accessGeneration);

	const [fields, setFields] = useState<Fields>(emptyFields);
	const [original, setOriginal] = useState<Fields>(emptyFields);
	const [sessionIdentity, setSessionIdentity] = useState<string>();
	const [isLoaded, setIsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>();
	const [confirmDiscard, setConfirmDiscard] = useState(false);

	const isDefaults = mode.kind === 'defaults';
	const title =
		mode.kind === 'create'
			? 'Create Template'
			: mode.kind === 'edit'
				? 'Edit Template'
				: 'Default Templates';
	const hasChanges =
		fields.name !== original.name ||
		fields.description !== original.description ||
		fields.compose !== original.compose ||
		fields.environment !== original.environment;
	const sessionChanged = isLoaded && sessionIdentity !== cacheSessionIdentity;
	const canSave =
		isLoaded &&
		sessionIdentity === cacheSessionIdentity &&
		hasPermission(
			mode.kind === 'create' ? Permission.Templates.create : Permission.Templates.update,
			null
		) &&
		(isDefaults || fields.name.trim() !== '');
	const readOnly = !canSave || isSaving;

	const update = (patch: Partial<Fields>) => setFields((current) => ({ ...current, ...patch }));

	const dismiss = useCallback(() => {
		if (router.canGoBack()) router.back();
	}, [router]);

	const load = useCallback(async () => {
		if (!client) return;
		const identity = useClientManager.getState().cacheSessionIdentity;
		setErrorMessage(undefined);
		try {
			let loaded = emptyFields;
			switch (mode.kind) {
				case 'create':
					break;
				case 'edit': {
					if (mode.template.isRemote || !hasPermission(Permission.Templates.read, null)) return;
					const content = await boundedAPIResponse<TemplateContent>(
						client,
						`templates/${escapedPathComponent(mode.template.id)}/content`,
						{
							maximumBytes: RemoteDataLimits.maximumTemplateBytes
						}
					);
					if (identity !== useClientManager.getState().cacheSessionIdentity) return;
					loaded = {
						name: content.template.name,
						description: content.template.description,
						compose: content.content,
						environment: content.envContent
					};
					break;
				}
				case 'defaults': {
					if (!hasPermission(Permission.Templates.read, null)) return;
					const defaults = await client.templates.getDefaults();
					if (identity !== useClientManager.getState().cacheSessionIdentity) return;
					loaded = {
						...emptyFields,
						compose: defaults.composeTemplate,
						environment: defaults.envTemplate
					};
					break;
				}
			}
			setFields(loaded);
			setOriginal(loaded);
			setSessionIdentity(identity);
			setIsLoaded(true);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		}
	}, [client, mode]);

	useEffect(() => {
		if (!isLoaded) void load();
	}, [load, isLoaded]);

	const save = async () => {
		if (!canSave || isSaving || !client) return;
		if (
			utf8Length(fields.compose) + utf8Length(fields.environment) >
			RemoteDataLimits.maximumTemplateBytes
		) {
			setErrorMessage('This template exceeds the supported editor size.');
			return;
		}
		const identity = useClientManager.getState().cacheSessionIdentity;
		const sessionStillCurrent = () => identity === useClientManager.getState().cacheSessionIdentity;
		setIsSaving(true);
		setErrorMessage(undefined);
		try {
			switch (mode.kind) {
				case 'create':
					await client.templates.create({
						body: {
							name: fields.name,
							description: fields.description,
							content: fields.compose,
							envContent: fields.environment
						}
					});
					break;
				case 'edit': {
					if (mode.template.isRemote) return;
					const latest = await client.templates.getContent({ id: mode.template.id });
					if (!sessionStillCurrent()) return;
					if (
						latest.content !== original.compose ||
						latest.envContent !== original.environment ||
						latest.template.name !== original.name ||
						latest.template.description !== original.description
					) {
						setErrorMessage(
							'This template changed on the server. Your draft is preserved. Reopen the template to load the latest version.'
						);
						return;
					}
					await client.templates.update({
						id: mode.template.id,
						body: {
							name: fields.name,
							description: fields.description,
							content: fields.compose,
							envContent: fields.environment
						}
					});
					break;
				}
				case 'defaults': {
					const latest = await client.templates.getDefaults();
					if (!sessionStillCurrent()) return;
					if (
						latest.composeTemplate !== original.compose ||
						latest.envTemplate !== original.environment
					) {
						setErrorMessage(
							'Default templates changed on the server. Your draft is preserved. Reopen this editor to load the latest version.'
						);
						return;
					}
					await client.templates.saveDefaults({
						body: { composeContent: fields.compose, envContent: fields.environment }
					});
					break;
				}
			}
			if (!sessionStillCurrent()) return;
			showToast(Toasts.success('Template saved'));
			await payload?.onSuccess();
			dismiss();
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	useDeleteConfirmation(
		confirmDiscard,
		setConfirmDiscard,
		{
			title: 'Discard template changes?',
			actions: [{ title: 'Discard Changes', action: dismiss }],
			cancelTitle: 'Keep Editing',
			dismissOnConfirm: false
		},
		templateEditorConfirmationHost
	);

	const cancel = () => {
		if (hasChanges) setConfirmDiscard(true);
		else dismiss();
	};

	return {
		title,
		isDefaults,
		fields,
		update,
		isLoaded,
		isSaving,
		errorMessage,
		sessionChanged,
		hasChanges,
		canSave,
		readOnly,
		dismissDisabled: hasChanges || isSaving,
		saveDisabled: !canSave || !hasChanges || isSaving,
		retry: () => void load(),
		save: () => void save(),
		cancel
	};
}

export type TemplateEditorModel = ReturnType<typeof useTemplateEditor>;
