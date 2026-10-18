import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { hasPermission, usePermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { boundedAPIResponse, RemoteDataLimits } from '@/core/networking/remote-data-limits';
import { escapedPathComponent } from '@/core/networking/server-identity';
import { withCleanup } from '@/core/with-cleanup';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
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

async function fetchTemplateFields(
	client: ArcaneClient,
	mode: TemplateEditorMode,
	identity: string | undefined
): Promise<Fields | undefined> {
	let loaded = emptyFields;
	switch (mode.kind) {
		case 'create':
			break;
		case 'edit': {
			if (mode.template.isRemote || !hasPermission(Permission.Templates.read, null))
				return undefined;
			const content = await boundedAPIResponse<TemplateContent>(
				client,
				`templates/${escapedPathComponent(mode.template.id)}/content`,
				{
					maximumBytes: RemoteDataLimits.maximumTemplateBytes
				}
			);
			if (identity !== useClientManager.getState().cacheSessionIdentity) return undefined;
			loaded = {
				name: content.template.name,
				description: content.template.description,
				compose: content.content,
				environment: content.envContent
			};
			break;
		}
		case 'defaults': {
			if (!hasPermission(Permission.Templates.read, null)) return undefined;
			const defaults = await client.templates.getDefaults();
			if (identity !== useClientManager.getState().cacheSessionIdentity) return undefined;
			loaded = {
				...emptyFields,
				compose: defaults.composeTemplate,
				environment: defaults.envTemplate
			};
			break;
		}
	}
	return loaded;
}

async function persistTemplate(
	client: ArcaneClient,
	mode: TemplateEditorMode,
	fields: Fields,
	original: Fields,
	sessionStillCurrent: () => boolean,
	onConflict: (message: string) => void
): Promise<boolean> {
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
			if (mode.template.isRemote) return false;
			const latest = await client.templates.getContent({ id: mode.template.id });
			if (!sessionStillCurrent()) return false;
			if (
				latest.content !== original.compose ||
				latest.envContent !== original.environment ||
				latest.template.name !== original.name ||
				latest.template.description !== original.description
			) {
				onConflict(
					'This template changed on the server. Your draft is preserved. Reopen the template to load the latest version.'
				);
				return false;
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
			if (!sessionStillCurrent()) return false;
			if (
				latest.composeTemplate !== original.compose ||
				latest.envTemplate !== original.environment
			) {
				onConflict(
					'Default templates changed on the server. Your draft is preserved. Reopen this editor to load the latest version.'
				);
				return false;
			}
			await client.templates.saveDefaults({
				body: { composeContent: fields.compose, envContent: fields.environment }
			});
			break;
		}
	}
	return true;
}

export function useTemplateEditor() {
	const { payload } = useRoutePayload<TemplateEditorPayload>();
	const [mode] = useState<TemplateEditorMode>(() => payload?.mode ?? { kind: 'create' });
	const router = useRouter();
	const client = useClientManager((s) => s.client);
	const cacheSessionIdentity = useClientManager((s) => s.cacheSessionIdentity);
	const canWriteTemplate = usePermission(
		mode.kind === 'create' ? Permission.Templates.create : Permission.Templates.update,
		null
	);

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
		canWriteTemplate &&
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
			const loaded = await fetchTemplateFields(client, mode, identity);
			if (loaded === undefined) return;
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
		await withCleanup(
			async () => {
				try {
					const saved = await persistTemplate(
						client,
						mode,
						fields,
						original,
						sessionStillCurrent,
						setErrorMessage
					);
					if (!saved) return;
					if (!sessionStillCurrent()) return;
					showToast(Toasts.success('Template saved'));
					if (payload) await payload.onSuccess();
					dismiss();
				} catch (error) {
					setErrorMessage(friendlyErrorMessage(error));
				}
			},
			() => setIsSaving(false)
		);
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
