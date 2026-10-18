import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import { withCleanup } from '@/core/with-cleanup';
import type { ArcaneClient } from '@/sdk/client/ArcaneClient';
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
	embedded?: boolean;
};

const pageSize = 50;

const withoutKey = (current: Record<string, IgnoredVulnerability>, key: string) => {
	const { [key]: _removed, ...rest } = current;
	return rest;
};

type VulnerabilitiesLive = {
	page: number;
	isLoading: boolean;
	hasMore: boolean;
	selectedSeverities: VulnerabilitySeverity[];
	vulnerabilities: VulnerabilityRecord[];
};

async function loadVulnerabilityPage({
	client,
	live,
	environmentID,
	imageID,
	setVulnerabilities,
	setCleared,
	setHasMore,
	setLoadMoreError,
	setIsLoading
}: {
	client: ArcaneClient;
	live: VulnerabilitiesLive;
	environmentID: EnvironmentID;
	imageID: string;
	setVulnerabilities: (vulnerabilities: VulnerabilityRecord[]) => void;
	setCleared: (cleared: boolean) => void;
	setHasMore: (hasMore: boolean) => void;
	setLoadMoreError: (error: string | undefined) => void;
	setIsLoading: (isLoading: boolean) => void;
}) {
	const page = live.page;
	let failed = false;
	try {
		const response = await client.vulnerabilities.listForImage({
			envID: environmentID,
			imageId: imageID,
			query: { start: (page - 1) * pageSize, limit: pageSize },
			severity: severityQuery(live.selectedSeverities)
		});
		const items = response.data.map(vulnerabilityRecord);
		const next = page === 1 ? items : [...live.vulnerabilities, ...items];
		live.vulnerabilities = next;
		setVulnerabilities(next);
		setCleared(false);
		const more = page * pageSize < response.pagination.totalItems;
		live.hasMore = more;
		setHasMore(more);
	} catch (error) {
		if (page > 1) {
			setLoadMoreError(friendlyErrorMessage(error));
			failed = true;
		}
	} finally {
		live.isLoading = false;
		setIsLoading(false);
	}
	return failed;
}

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

	const live = useRef({
		page: 1,
		isLoading: false,
		hasMore: false,
		selectedSeverities: [] as VulnerabilitySeverity[],
		vulnerabilities: [] as VulnerabilityRecord[]
	});

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
			setSummary(undefined);
		}
	};

	const loadVulnerabilities = async () => {
		const client = useClientManager.getState().client;
		if (!client) return false;
		setLoadMoreError(undefined);
		live.current.isLoading = true;
		setIsLoading(true);
		return loadVulnerabilityPage({
			client,
			live: live.current,
			environmentID,
			imageID,
			setVulnerabilities,
			setCleared,
			setHasMore,
			setLoadMoreError,
			setIsLoading
		});
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

	const startInitialLoad = useEffectEvent(() => {
		void initialLoad();
	});

	useEffect(() => {
		startInitialLoad();
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
		await withCleanup(
			async () => {
				try {
					await client.vulnerabilities.scanImage({ envID: environmentID, imageId: imageID });
					await reload();
					showToast(Toasts.success('Scan complete'));
				} catch (error) {
					showError(friendlyErrorMessage(error));
				}
			},
			() => setIsScanning(false)
		);
	};

	const unignore = async (ignoreId: string, key: string) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		try {
			await client.vulnerabilities.unignore({ envID: environmentID, ignoreId });
			setIgnoredById((current) => withoutKey(current, key));
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

	const hasPatchPermission = useClientManager(() => hasPermission('images:patch', environmentID));
	const canPatch = hasPatchPermission && supportsActivities;

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
