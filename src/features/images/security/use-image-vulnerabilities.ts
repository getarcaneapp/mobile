/**
 * The platform-neutral model behind `ImageVulnerabilitiesView`
 * (ImageVulnerabilitiesView.swift): scanner status, scan summary, paginated
 * findings with severity filtering, the ignored toggle, re-scan, and
 * ignore / unignore.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { User } from '@/sdk/models/user/User';
import { useClientManager } from '@/stores/client-manager';
import { showToast, Toasts } from '@/ui/toast';

import { useSecurityNavigation } from './security-routes';
import {
	ignoreKey,
	scanSummary,
	severityQuery,
	vulnerabilityRecord,
	type IgnoredVulnerability,
	type ScannerStatus,
	type ScanSummary,
	type VulnerabilityRecord,
	type VulnerabilitySeverity
} from './vulnerability-model';

export type ImageVulnerabilitiesProps = {
	imageID: string;
	imageDisplayName: string;
	environmentID: EnvironmentID;
	/** Rendered inside the image detail screen: no title of its own. */
	embedded?: boolean;
};

const pageSize = 50;

export function useImageVulnerabilities({
	imageID,
	imageDisplayName,
	environmentID
}: ImageVulnerabilitiesProps) {
	const nav = useSecurityNavigation();
	const currentUser = useClientManager((s) => s.currentUser);
	useClientManager((s) => s.accessGeneration);
	const supportsActivities = useClientManager((s) => s.supportsActivities());
	const isAdmin = currentUser ? User.isAdmin(currentUser) : false;

	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [status, setStatus] = useState<ScannerStatus>();
	const [summary, setSummary] = useState<ScanSummary>();
	const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityRecord[]>([]);
	const [ignoredById, setIgnoredById] = useState<Record<string, IgnoredVulnerability>>({});
	const [selectedSeverities, setSelectedSeverities] = useState<VulnerabilitySeverity[]>([]);
	const [showIgnored, setShowIgnored] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isScanning, setIsScanning] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [cleared, setCleared] = useState(false);

	// Values the async loaders read synchronously (Swift reads `@State` live).
	const live = useRef({
		page: 1,
		isLoading: false,
		hasMore: false,
		selectedSeverities: [] as VulnerabilitySeverity[],
		vulnerabilities: [] as VulnerabilityRecord[]
	});

	/** `displayedVulnerabilities` (rebuilt whenever its inputs change). */
	const displayedVulnerabilities = useMemo(
		() =>
			cleared
				? []
				: vulnerabilities.filter((v) => showIgnored || ignoredById[ignoreKey(v)] === undefined),
		[cleared, vulnerabilities, ignoredById, showIgnored]
	);

	const showError = (message: string) => Alert.alert('Error', message, [{ text: 'OK' }]);

	const loadStatus = async () => {
		const client = useClientManager.getState().client;
		if (!client) return undefined;
		let next: ScannerStatus;
		try {
			const result = await client.vulnerabilities.scannerStatus({ envID: environmentID });
			next = { available: result.available, version: result.version };
		} catch {
			// Treat as unavailable.
			next = { available: false };
		}
		setStatus(next);
		return next;
	};

	const loadSummary = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			setSummary(
				scanSummary(
					await client.vulnerabilities.scanSummary({ envID: environmentID, imageId: imageID })
				)
			);
		} catch {
			// Likely 404 (no scan yet) — leave summary nil.
			setSummary(undefined);
		}
	};

	const loadVulnerabilities = async () => {
		const client = useClientManager.getState().client;
		if (!client) return false;
		setLoadMoreError(undefined);
		live.current.isLoading = true;
		setIsLoading(true);
		const page = live.current.page;
		let failed = false;
		try {
			const response = await client.vulnerabilities.listForImage({
				envID: environmentID,
				imageId: imageID,
				query: { start: (page - 1) * pageSize, limit: pageSize },
				severity: severityQuery(live.current.selectedSeverities)
			});
			const items = response.data.map(vulnerabilityRecord);
			const next = page === 1 ? items : [...live.current.vulnerabilities, ...items];
			live.current.vulnerabilities = next;
			setVulnerabilities(next);
			setCleared(false);
			const more = page * pageSize < response.pagination.totalItems;
			live.current.hasMore = more;
			setHasMore(more);
		} catch (error) {
			if (page > 1) {
				setLoadMoreError(friendlyErrorMessage(error));
				failed = true;
			}
		} finally {
			live.current.isLoading = false;
			setIsLoading(false);
		}
		return failed;
	};

	const reload = async () => {
		live.current.page = 1;
		setCleared(true);
		await loadSummary();
		await loadVulnerabilities();
	};

	const initialLoad = async () => {
		const next = await loadStatus();
		if (next?.available === true) await reload();
	};

	const loadMore = async () => {
		if (!live.current.hasMore || live.current.isLoading) return;
		live.current.page += 1;
		const failed = await loadVulnerabilities();
		if (failed) live.current.page -= 1;
	};

	useEffect(() => {
		void initialLoad();
		// `.task`: once per appearance of this image's view.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const toggleSeverity = (severity: VulnerabilitySeverity) => {
		const current = live.current.selectedSeverities;
		const next = current.includes(severity)
			? current.filter((s) => s !== severity)
			: [...current, severity];
		live.current.selectedSeverities = next;
		setSelectedSeverities(next);
		void reload();
	};

	const runScan = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsScanning(true);
		try {
			await client.vulnerabilities.scanImage({ envID: environmentID, imageId: imageID });
			await reload();
			showToast(Toasts.success('Scan complete'));
		} catch (error) {
			showError(friendlyErrorMessage(error));
		} finally {
			setIsScanning(false);
		}
	};

	const unignore = async (ignoreId: string, key: string) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			await client.vulnerabilities.unignore({ envID: environmentID, ignoreId });
			setIgnoredById((current) => {
				const { [key]: _removed, ...rest } = current;
				return rest;
			});
			setCleared(false);
			showToast(Toasts.success('Vulnerability unignored'));
		} catch (error) {
			showError(friendlyErrorMessage(error));
		}
	};

	const requestIgnore = (vulnerability: VulnerabilityRecord) => {
		const key = ignoreKey(vulnerability);
		nav.openIgnore({
			vulnerability,
			imageID,
			environmentID,
			onIgnored: (record) => {
				setIgnoredById((current) => ({ ...current, [key]: record }));
				setCleared(false);
			}
		});
	};

	const ignoreInfo = (vulnerability: VulnerabilityRecord): IgnoredVulnerability | undefined =>
		ignoredById[ignoreKey(vulnerability)];

	const canPatch = hasPermission('images:patch', environmentID) && supportsActivities;

	return {
		imageID,
		imageDisplayName,
		environmentID,
		isAdmin,
		status,
		summary,
		displayedVulnerabilities,
		selectedSeverities,
		showIgnored,
		toggleShowIgnored: () => {
			setShowIgnored((value) => !value);
			setCleared(false);
		},
		isLoading,
		isScanning,
		hasMore,
		loadMoreError,
		canPatch,
		ignoreInfo,
		toggleSeverity,
		initialLoad,
		reload,
		loadMore,
		runScan,
		requestIgnore,
		unignore: (vulnerability: VulnerabilityRecord) => {
			const ignore = ignoreInfo(vulnerability);
			if (ignore) void unignore(ignore.id, ignoreKey(vulnerability));
		},
		openDetail: (record: VulnerabilityRecord) =>
			nav.openVulnerabilityDetail({ record, ignoreInfo: ignoreInfo(record) }),
		openPatch: () => nav.openPatch(environmentID, imageID, imageDisplayName)
	};
}

export type ImageVulnerabilitiesModel = ReturnType<typeof useImageVulnerabilities>;
