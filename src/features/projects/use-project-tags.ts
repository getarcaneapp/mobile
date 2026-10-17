/**
 * `ProjectTagsSheet` state (ProjectTagsSheet.swift): attach, detach, and
 * create project tags. Each change is a single `PATCH projects/{id}/tags`;
 * tags declared in the compose file are shown but locked.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { friendlyErrorMessage } from '@/core/errors';
import type { ProjectTag } from '@/sdk/models/project/ProjectTag';
import { useClientManager } from '@/stores/client-manager';

import { localizedStandardCompare } from '@/features/containers/container-model';

import {
	projectTagIsComposeManaged,
	tagOptionAsTag,
	type ProjectTagOption,
	type UpdateProjectTagRequest,
	type UpdateProjectTagResponse
} from './project-model';
import { routePayloads, type ProjectTagsPayload } from './project-routes';

export function useProjectTags() {
	const router = useRouter();
	const {
		envID = '0',
		projectID = '',
		token
	} = useLocalSearchParams<{ envID?: string; projectID?: string; token?: string }>();
	const [payload] = useState(() => routePayloads.get<ProjectTagsPayload>(token));
	useEffect(() => () => routePayloads.delete(token), [token]);

	const [tags, setTags] = useState<ProjectTag[]>(() => payload?.tags ?? []);
	const [catalog, setCatalog] = useState<ProjectTagOption[]>([]);
	const [newName, setNewName] = useState('');
	const [newColor, setNewColor] = useState('blue');
	const [pendingName, setPendingName] = useState<string>();
	const [errorMessage, setErrorMessage] = useState<string>();

	// `.task { await loadCatalog() }`.
	useEffect(() => {
		const client = useClientManager.getState().client;
		if (!client) return;
		let cancelled = false;
		client.rest
			.get<ProjectTagOption[]>(client.rest.environmentPath(envID, 'projects/tags'))
			.then((options) => {
				if (!cancelled) setCatalog(options ?? []);
			})
			.catch(() => {
				if (!cancelled) setCatalog([]);
			});
		return () => {
			cancelled = true;
		};
	}, [envID]);

	/** Attached tags first, then unattached catalog tags. */
	const rows = useMemo(() => {
		const attachedNames = new Set(tags.map((t) => t.name));
		const unattached = catalog
			.filter((option) => !attachedNames.has(option.name))
			.map(tagOptionAsTag);
		const byName = (a: ProjectTag, b: ProjectTag) => localizedStandardCompare(a.name, b.name);
		return [...[...tags].sort(byName), ...unattached.sort(byName)];
	}, [tags, catalog]);

	const trimmedNewName = newName.trim();

	const setTag = async (name: string, attached: boolean, color: string | undefined) => {
		const client = useClientManager.getState().client;
		if (!client || name === '') return;
		setPendingName(name);
		setErrorMessage(undefined);
		try {
			const body: UpdateProjectTagRequest = { name, attached, color };
			const response = await client.rest.patch<UpdateProjectTagResponse>(
				client.rest.environmentPath(envID, `projects/${encodeURIComponent(projectID)}/tags`),
				{ body }
			);
			const next = response.tags ?? [];
			setTags(next);
			if (attached && name === trimmedNewName) setNewName('');
			if (attached && color !== undefined && !catalog.some((option) => option.name === name)) {
				setCatalog((current) => [...current, { name, color }]);
			}
			payload?.onChange(next);
		} catch (error) {
			setErrorMessage(friendlyErrorMessage(error));
		} finally {
			setPendingName(undefined);
		}
	};

	return {
		rows,
		isAttached: (tag: ProjectTag) => tags.some((t) => t.name === tag.name),
		hasComposeManaged: tags.some(projectTagIsComposeManaged),
		newName,
		setNewName,
		newColor,
		setNewColor,
		trimmedNewName,
		pendingName,
		errorMessage,
		toggle: (tag: ProjectTag) =>
			void setTag(tag.name, !tags.some((t) => t.name === tag.name), tag.color),
		addTag: () => void setTag(trimmedNewName, true, newColor),
		done: () => {
			if (router.canGoBack()) router.back();
		}
	};
}
