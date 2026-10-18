import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { hasPermission } from '@/core/auth/permissions';
import { formattedISO8601 } from '@/core/date-formatting';
import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import { cachedClient } from '@/core/networking/use-cached-client';
import { useContainerNavigation } from '@/features/containers/container-routes';
import { useOnChange } from '@/features/containers/hooks';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { ImageDetailSummary } from '@/sdk/models/image/ImageDetail';
import { ImageSummary } from '@/sdk/models/image/ImageSummary';
import { ImageUpdateInfo } from '@/sdk/models/image/ImageUpdateInfo';
import type { ImageUpdateResponse } from '@/sdk/models/imageUpdate/ImageUpdate';
import { useClientManager } from '@/stores/client-manager';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import {
	nonEmptyResourceValue,
	type ResourceMetadataItem
} from '@/ui/components/resource-detail.types';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { showToast, Toasts } from '@/ui/toast';

import { imagesChanged } from './image-actions';
import {
	byteString,
	containerUsesImage,
	imageDisplayName,
	taggedReferences,
	updateStateFromResponse
} from './image-model';
import { imageCache, useImageNavigation } from './image-routes';

export type ImageDetailSection = 'overview' | 'history' | 'attestations' | 'vulnerabilities';

export const imageDetailSections: {
	value: ImageDetailSection;
	title: string;
	systemImage: string;
	tint: string;
}[] = [
	{
		value: 'overview',
		title: 'Overview',
		systemImage: 'info.circle.fill',
		tint: systemColors.purple
	},
	{
		value: 'history',
		title: 'History',
		systemImage: 'square.stack.3d.down.right.fill',
		tint: systemColors.blue
	},
	{
		value: 'attestations',
		title: 'Attestations',
		systemImage: 'checkmark.seal.fill',
		tint: systemColors.green
	},
	{
		value: 'vulnerabilities',
		title: 'Vulnerabilities',
		systemImage: 'shield.lefthalf.filled',
		tint: systemColors.orange
	}
];

export const headerDate = (iso: string) => formattedISO8601(iso, 'abbreviated', 'omitted');

async function loadUpdateInfo(
	client: ArcaneClient,
	environmentID: EnvironmentID,
	refs: string[],
	setUpdateInfo: (info: ImageUpdateResponse) => void
) {
	try {
		const map = await client.images.updateInfoByRefs({ envID: environmentID, imageRefs: refs });
		for (const tag of refs) {
			const info = map[tag];
			if (info) {
				setUpdateInfo(ImageUpdateInfo.asUpdateResponse(info));
				break;
			}
		}
	} catch {}
}

async function downloadImageArchive({
	client,
	environmentID,
	imageID,
	directory,
	abort,
	startGeneration,
	cleanupExport,
	setExportedImage
}: {
	client: ArcaneClient;
	environmentID: EnvironmentID;
	imageID: string;
	directory: Directory;
	abort: AbortController;
	startGeneration: number;
	cleanupExport: () => void;
	setExportedImage: (uri: string) => void;
}) {
	try {
		directory.create({ intermediates: true });
		const request = await client.images.exportDownloadRequest({
			envID: environmentID,
			imageID
		});
		const file = await File.downloadFileAsync(request.url, new File(directory, 'image.tar'), {
			headers: request.headers,
			idempotent: true
		});
		if (abort.signal.aborted || startGeneration !== useClientManager.getState().clientGeneration) {
			try {
				directory.delete();
			} catch {}
			return;
		}
		cleanupExport();
		setExportedImage(file.uri);
		showToast(Toasts.info('Image archive ready to share from the actions menu'));
	} catch (error) {
		try {
			directory.delete();
		} catch {}
		if (!abort.signal.aborted)
			showToast(Toasts.error(error instanceof Error ? error.message : String(error)));
	}
}

export function useImageDetail(environmentID: EnvironmentID, imageID: string) {
	const nav = useImageNavigation();
	const containerNav = useContainerNavigation();
	const accent = useAccentColor();
	const [image] = useState<ImageSummary>(
		() => imageCache.summary(environmentID, imageID) ?? ImageSummary.make({ id: imageID })
	);
	const [details, setDetails] = useState<ImageDetailSummary | undefined>(() =>
		imageCache.details(environmentID, imageID)
	);
	const [isLoading, setIsLoading] = useState(false);
	const [updateInfo, setUpdateInfo] = useState<ImageUpdateResponse>();
	const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
	const [usingContainers, setUsingContainers] = useState<ContainerSummary[]>([]);
	const [selectedSection, setSelectedSection] = useState<ImageDetailSection>('overview');
	const [exportedImage, setExportedImage] = useState<string>();
	const [exporting, setExporting] = useState(false);
	const exportController = useRef<AbortController | undefined>(undefined);
	const exportedRef = useRef<string | undefined>(undefined);
	useLayoutEffect(() => {
		exportedRef.current = exportedImage;
	});
	useClientManager((s) => s.accessGeneration);
	const generation = useClientManager((s) => s.clientGeneration);
	const activeEnvironmentID = useClientManager((s) => s.activeEnvironmentID);

	const showError = (error: unknown) =>
		Alert.alert('Error', friendlyErrorMessage(error), [{ text: 'OK', onPress: () => {} }]);

	const loadDetails = useCallback(async () => {
		const client = useClientManager.getState().client;
		const cached = cachedClient();
		if (!client || !cached) return;
		setIsLoading(true);
		await withCleanup(
			async () => {
				try {
					const loaded = await cached.get<ImageDetailSummary>(
						client.rest.environmentPath(environmentID, `images/${imageID}`),
						environmentID
					);
					imageCache.setDetails(environmentID, loaded, imageID);
					setDetails(loaded);
				} catch {}
			},
			() => setIsLoading(false)
		);
	}, [environmentID, imageID]);

	const loadUpdateStatus = useCallback(async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const refs = taggedReferences(image.repoTags);
		if (refs.length === 0) return;
		await loadUpdateInfo(client, environmentID, refs, setUpdateInfo);
	}, [environmentID, image]);

	const loadUsingContainers = useCallback(async () => {
		const client = useClientManager.getState().client;
		const cached = cachedClient();
		if (!client || !cached) return;
		try {
			const all = await cached.getAllPages<ContainerSummary>(
				client.rest.environmentPath(environmentID, 'containers'),
				environmentID,
				async (start, limit) => {
					const response = await client.containers.list({
						envID: environmentID,
						query: { start, limit }
					});
					return { items: response.data, pagination: response.pagination };
				}
			);
			setUsingContainers(all.filter((container) => containerUsesImage(image, container)));
		} catch {}
	}, [environmentID, image]);

	useEffect(() => {
		void loadDetails();
		void loadUpdateStatus();
		void loadUsingContainers();
	}, [loadDetails, loadUpdateStatus, loadUsingContainers]);

	const checkForUpdate = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsCheckingUpdate(true);
		await withCleanup(
			async () => {
				try {
					setUpdateInfo(
						await client.images.checkUpdateByIDPost({ envID: environmentID, imageId: image.id })
					);
				} catch (error) {
					showError(error);
				}
			},
			() => setIsCheckingUpdate(false)
		);
	};

	const cleanupExport = useCallback(() => {
		const uri = exportedRef.current;
		if (uri) {
			try {
				new File(uri).parentDirectory.delete();
			} catch {}
		}
		setExportedImage(undefined);
	}, []);

	const exportImage = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const startGeneration = useClientManager.getState().clientGeneration;
		const abort = new AbortController();
		exportController.current = abort;
		const directory = new Directory(Paths.cache, randomUUID());
		setExporting(true);
		await withCleanup(
			() =>
				downloadImageArchive({
					client,
					environmentID,
					imageID: image.id,
					directory,
					abort,
					startGeneration,
					cleanupExport,
					setExportedImage
				}),
			() => setExporting(false)
		);
	};

	const shareExport = () => {
		if (exportedImage)
			void Sharing.shareAsync(exportedImage, {
				mimeType: 'application/x-tar',
				UTI: 'public.tar-archive'
			});
	};

	useEffect(
		() => () => {
			exportController.current?.abort();
			cleanupExport();
		},
		[cleanupExport]
	);
	const onContextChange = () => {
		exportController.current?.abort();
		cleanupExport();
	};
	useOnChange(generation, onContextChange);
	useOnChange(activeEnvironmentID, onContextChange);

	const removeImage = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			await client.images.remove({ envID: environmentID, id: image.id });
			imagesChanged(environmentID);
			showToast(Toasts.success('Image removed'));
		} catch (error) {
			showError(error);
		}
	};

	const primary: ActionButtonItem = {
		id: 'recheck',
		title: 'Recheck for Updates',
		systemImage: 'arrow.triangle.2.circlepath',
		tint: accent,
		action: () => void checkForUpdate()
	};

	const canTag = useClientManager(() => hasPermission('images:tag', environmentID));
	const canRead = useClientManager(() => hasPermission('images:read', environmentID));
	const overflow: ActionButtonItem[] = [
		...(canTag
			? [
					{
						id: 'tag',
						title: 'Tag Image',
						systemImage: 'tag',
						tint: accent,
						action: () => nav.openTag(environmentID, image.id)
					}
				]
			: []),
		...(canRead
			? [
					{
						id: 'export',
						title: exporting ? 'Exporting…' : 'Export Image',
						systemImage: 'square.and.arrow.up',
						tint: accent,
						action: () => {
							if (!exporting) void exportImage();
						}
					}
				]
			: []),
		{
			id: 'remove',
			title: 'Remove Image',
			systemImage: 'trash',
			tint: systemColors.red,
			role: 'destructive',
			confirmationMessage: 'This will remove the image from the host.',
			action: () => void removeImage()
		}
	];

	const metadataItems = (value: ImageDetailSummary): ResourceMetadataItem[] => [
		{ label: 'Size', value: byteString(value.size), systemImage: 'internaldrive' },
		{ label: 'Created', value: headerDate(value.created), systemImage: 'calendar' },
		{ label: 'Platform', value: `${value.os}/${value.architecture}`, systemImage: 'cpu' },
		{
			label: 'Author',
			value: nonEmptyResourceValue(value.author) ?? 'Unknown',
			systemImage: 'person'
		},
		{
			label: 'Docker',
			value: nonEmptyResourceValue(value.dockerVersion) ?? 'Unknown',
			systemImage: 'shippingbox'
		},
		{ label: 'Consumers', value: String(usingContainers.length), systemImage: 'cube.box' }
	];

	const updateState = updateStateFromResponse(updateInfo);
	const versionChange =
		updateInfo?.hasUpdate &&
		updateInfo.latestVersion !== undefined &&
		updateInfo.currentVersion !== '' &&
		updateInfo.latestVersion !== updateInfo.currentVersion
			? `${updateInfo.currentVersion} → ${updateInfo.latestVersion}`
			: undefined;

	return {
		environmentID,
		image,
		displayName: imageDisplayName(image),
		details,
		isLoading,
		isCheckingUpdate,
		updateState,
		versionChange,
		usingContainers,
		metadataItems,
		selectedSection,
		setSelectedSection,
		refresh: loadDetails,
		openContainer: (container: ContainerSummary) =>
			containerNav.openDetail(environmentID, container),
		openConfigPage: (page: 'env' | 'labels') => nav.openConfigPage(page, environmentID, image.id),
		exportedImage,
		shareExport,
		toolbar: {
			primary,
			overflow,
			runningItemID: isCheckingUpdate ? 'recheck' : undefined,
			isDisabled: isCheckingUpdate
		}
	};
}

export type ImageDetailModel = ReturnType<typeof useImageDetail>;
