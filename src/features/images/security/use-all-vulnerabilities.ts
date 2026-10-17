/**
 * The platform-neutral model behind `AllVulnerabilitiesView`
 * (AllVulnerabilitiesView.swift): the Overview (risk overview or environment
 * summary) and Findings sections, Findings across one or every enabled
 * environment, the Filters sheet state, focusing one CVE from the overview,
 * CSV export, and the patch-targets toolbar action.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { hasPermission } from '@/core/auth/permissions';
import { friendlyErrorMessage } from '@/core/errors';
import type { EnvironmentID } from '@/sdk/client/environment';
import { isArcaneError } from '@/sdk/errors/ArcaneError';
import type { EnvironmentVulnerabilitySummary } from '@/sdk/models/vulnerability/Vulnerability';
import type { VulnerabilityRiskOverview } from '@/sdk/types/VulnerabilityRiskOverview';
import { useClientManager } from '@/stores/client-manager';
import {
	useEnvironmentPagedList,
	type EnvironmentFetch,
	type EnvironmentItem
} from '@/stores/environment-paged-list';
import { useEnvironmentsStore, type ListEnvironment } from '@/stores/environments-store';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import type { ScrollableTabOption } from '@/ui/components/scrollable-tab-bar.types';
import { showToast, Toasts } from '@/ui/toast';

import {
	securityFilterSnapshot,
	useSecurityFilter,
	useSecurityFilterStore
} from './security-filter-store';
import { useSecurityNavigation } from './security-routes';
import {
	severityQuery,
	vulnerabilityFinding,
	type VulnerabilityFinding
} from './vulnerability-model';

const pageSize = 50;

export type SecuritySection = 'overview' | 'findings';

export type FindingItem = EnvironmentItem<VulnerabilityFinding>;

export type AllVulnerabilitiesProps = {
	environmentID: EnvironmentID;
	/**
	 * All Environments preview: Findings lists vulnerabilities from every
	 * enabled environment; Overview shows the environment chosen in the toolbar.
	 */
	allEnvironments?: boolean;
};

let listCounter = 0;

export function useAllVulnerabilities({
	environmentID,
	allEnvironments = false
}: AllVulnerabilitiesProps) {
	const nav = useSecurityNavigation();
	const accent = useAccentColor();
	const supportsActivities = useClientManager((s) => s.supportsActivities());
	useClientManager((s) => s.accessGeneration);
	useEnvironmentsStore((s) => s.environments);
	const enabledEnvironments = useEnvironmentsStore.getState().enabledEnvironments();

	const [listKey] = useState(() => `security-${++listCounter}`);
	const filter = useSecurityFilter(listKey);
	const updateFilter = useSecurityFilterStore((s) => s.update);
	useEffect(() => () => useSecurityFilterStore.getState().remove(listKey), [listKey]);

	const [list, snapshot] = useEnvironmentPagedList<VulnerabilityFinding>(pageSize);
	const items = snapshot.items;

	const [overview, setOverview] = useState<VulnerabilityRiskOverview>();
	const [overviewError, setOverviewError] = useState<string>();
	const [summary, setSummary] = useState<EnvironmentVulnerabilitySummary>();
	const [exportURI, setExportURI] = useState<string>();
	const [isExporting, setIsExporting] = useState(false);
	const [focusedVulnerabilityID, setFocusedVulnerabilityIDState] = useState<string>();
	const [selectedSection, setSelectedSection] = useState<SecuritySection>('overview');
	const [chosenEnvironmentID, setChosenEnvironmentIDState] = useState<EnvironmentID>();
	const [cleared, setCleared] = useState(false);

	// Values async work reads synchronously (Swift reads `@State` live).
	const live = useRef({
		focusedVulnerabilityID: undefined as string | undefined,
		chosenEnvironmentID: undefined as EnvironmentID | undefined
	});
	const setFocusedVulnerabilityID = (id: string | undefined) => {
		live.current.focusedVulnerabilityID = id;
		setFocusedVulnerabilityIDState(id);
	};
	const currentOverviewEnvironmentID = () =>
		allEnvironments ? (live.current.chosenEnvironmentID ?? environmentID) : environmentID;
	const overviewEnvironmentID = allEnvironments
		? (chosenEnvironmentID ?? environmentID)
		: environmentID;

	/** The environments this list covers, known before the first load finishes. */
	const listEnvironments: ListEnvironment[] = allEnvironments
		? snapshot.environments
		: [{ id: environmentID }];

	const filterCount =
		filter.selectedSeverities.length +
		(filter.selectedImage === undefined ? 0 : 1) +
		(filter.onlyFixAvailable ? 1 : 0) +
		(filter.environmentFilter === undefined ? 0 : 1);

	/** `displayedItems`. */
	const displayedItems = useMemo(
		() =>
			cleared
				? []
				: items.filter(
						(item) =>
							filter.environmentFilter === undefined ||
							item.environmentID === filter.environmentFilter
					),
		[cleared, items, filter.environmentFilter]
	);

	// Keep the Filters sheet's Environment section in sync with the list.
	useEffect(() => {
		updateFilter(listKey, { environments: snapshot.environments });
	}, [listKey, snapshot.environments, updateFilter]);

	const showError = (message: string) => Alert.alert('Error', message, [{ text: 'OK' }]);

	// MARK: Loading

	const findingsPage = (): EnvironmentFetch<VulnerabilityFinding> | undefined => {
		const client = useClientManager.getState().client;
		if (!client) return undefined;
		const search = live.current.focusedVulnerabilityID;
		const current = securityFilterSnapshot(listKey);
		const severity = severityQuery(current.selectedSeverities);
		const imageName = current.selectedImage;
		const fixAvailable = current.onlyFixAvailable ? true : undefined;
		return async (envID, start, limit) => {
			const response = await client.vulnerabilities.listAll({
				envID,
				query: { search, start, limit },
				severity,
				imageName,
				fixAvailable
			});
			return { items: response.data.map(vulnerabilityFinding), pagination: response.pagination };
		};
	};

	const reload = async () => {
		const fetch = findingsPage();
		if (!fetch) return;
		const environments = await useEnvironmentsStore
			.getState()
			.listEnvironments(environmentID, allEnvironments);
		await list.reload(environments, fetch);
		setCleared(false);
		const error = list.getSnapshot().errorMessage;
		if (error !== undefined) showError(error);
	};

	const loadMore = async () => {
		const fetch = findingsPage();
		if (!fetch) return;
		await list.loadMore(fetch);
	};

	const loadOverview = async () => {
		const client = useClientManager.getState().client;
		if (!useClientManager.getState().supportsActivities() || !client) return;
		const target = currentOverviewEnvironmentID();
		try {
			const response = await client.vulnerabilities.riskOverview({ envID: target });
			if (target !== currentOverviewEnvironmentID()) return;
			setOverview(response);
			setOverviewError(undefined);
		} catch (error) {
			if (target !== currentOverviewEnvironmentID()) return;
			setOverview(undefined);
			setOverviewError(
				isArcaneError(error, 'notFound')
					? undefined
					: `Risk overview unavailable: ${friendlyErrorMessage(error)}`
			);
		}
	};

	const loadSummary = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const target = currentOverviewEnvironmentID();
		try {
			const response = await client.vulnerabilities.environmentSummary({ envID: target });
			if (target !== currentOverviewEnvironmentID()) return;
			setSummary(response);
		} catch {
			// Best effort.
		}
	};

	const loadOverviewSection = async () => {
		await Promise.all([loadOverview(), loadSummary()]);
	};

	/** All Environments merges every environment's image names. */
	const loadImageOptions = async () => {
		const client = useClientManager.getState().client;
		if (!client) return;
		const environments = await useEnvironmentsStore
			.getState()
			.listEnvironments(environmentID, allEnvironments);
		const severity = severityQuery(securityFilterSnapshot(listKey).selectedSeverities);
		const results = await Promise.all(
			environments.map((environment) =>
				client.vulnerabilities
					.imageOptions({ envID: environment.id, severity })
					.catch(() => undefined)
			)
		);
		const options = results.filter((result): result is string[] => result !== undefined);
		const imageOptions =
			environments.length === 1
				? (options[0] ?? [])
				: [...new Set(options.flat())].sort((a, b) =>
						a.localeCompare(b, undefined, { numeric: true })
					);
		updateFilter(listKey, { imageOptions });
	};

	const loadInitial = async () => {
		// Overview, summary, filter options, and findings are independent.
		await Promise.all([loadOverviewSection(), loadImageOptions(), reload()]);
	};

	const clearItems = () => {
		list.updateItems(() => []);
		setCleared(true);
	};

	useEffect(() => {
		// `.task(id: environmentID)`; the destination re-keys on environment.
		void loadInitial();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// The Filters sheet's Done button.
	const doneRevision = filter.doneRevision;
	const lastDone = useRef(doneRevision);
	useEffect(() => {
		if (lastDone.current === doneRevision) return;
		lastDone.current = doneRevision;
		void reload();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [doneRevision]);

	// MARK: Actions

	const selectOverviewEnvironment = (id: EnvironmentID) => {
		if (id === currentOverviewEnvironmentID()) return;
		live.current.chosenEnvironmentID = id;
		setChosenEnvironmentIDState(id);
		setOverview(undefined);
		setOverviewError(undefined);
		setSummary(undefined);
		void loadOverviewSection();
	};

	const showVulnerability = (id: string) => {
		updateFilter(listKey, {
			selectedSeverities: [],
			selectedImage: undefined,
			onlyFixAvailable: false
		});
		setFocusedVulnerabilityID(id);
		clearItems();
		setSelectedSection('findings');
		void reload();
	};

	const clearFocus = () => {
		setFocusedVulnerabilityID(undefined);
		clearItems();
		void reload();
	};

	const exportCSV = async (targetEnvironmentID: EnvironmentID) => {
		const client = useClientManager.getState().client;
		if (!client) return;
		setIsExporting(true);
		try {
			const current = securityFilterSnapshot(listKey);
			const data = await client.vulnerabilities.exportAll({
				envID: targetEnvironmentID,
				search: live.current.focusedVulnerabilityID,
				severity: severityQuery(current.selectedSeverities),
				imageName: current.selectedImage,
				fixAvailable: current.onlyFixAvailable ? true : undefined
			});
			const file = new File(
				Paths.cache,
				`vulnerabilities-${targetEnvironmentID}-${Math.floor(Date.now() / 1000)}.csv`
			);
			if (file.exists) file.delete();
			file.create();
			await file.write(data);
			if (exportURI !== undefined) {
				try {
					const old = new File(exportURI);
					if (old.exists) old.delete();
				} catch {
					// Best effort.
				}
			}
			setExportURI(file.uri);
			showToast(Toasts.success('Vulnerabilities exported'));
		} catch (error) {
			showError(friendlyErrorMessage(error));
		} finally {
			setIsExporting(false);
		}
	};

	/** `ShareLink("Share exported CSV", item: exportURL)`. */
	const shareExport = () => {
		if (exportURI === undefined) return;
		void Sharing.shareAsync(exportURI, {
			mimeType: 'text/csv',
			UTI: 'public.comma-separated-values-text'
		}).catch((error: unknown) => showError(friendlyErrorMessage(error)));
	};

	const sectionOptions: ScrollableTabOption<SecuritySection>[] = [
		{ value: 'overview', title: 'Overview', systemImage: 'shield.lefthalf.filled', tint: accent },
		{ value: 'findings', title: 'Findings', systemImage: 'list.bullet', tint: systemColors.orange }
	];

	// MARK: Toolbar

	const patchEnvironments = listEnvironments.filter((environment) =>
		hasPermission('vulnerabilities:read', environment.id)
	);
	const exportEnvironments = listEnvironments.filter((environment) =>
		items.some((item) => item.environmentID === environment.id)
	);
	const toolbar = {
		/** All Environments: the "Patch images" environment action. */
		showsPatchEnvironmentAction: allEnvironments && supportsActivities,
		/** Single environment: the "Patch images" link. */
		showsPatchLink:
			!allEnvironments &&
			hasPermission('vulnerabilities:read', environmentID) &&
			supportsActivities,
		showsOverviewEnvironmentPicker: allEnvironments && selectedSection === 'overview',
		showsFindingsActions: selectedSection === 'findings',
		exportDisabled: isExporting || items.length === 0
	};

	return {
		environmentID,
		allEnvironments,
		snapshot,
		overview,
		overviewError,
		summary,
		overviewEnvironmentID,
		enabledEnvironments,
		displayedItems,
		focusedVulnerabilityID,
		exportURI,
		selectedSection,
		setSelectedSection,
		sectionOptions,
		filterCount,
		toolbar,
		patchEnvironments,
		exportEnvironments,
		refresh: loadInitial,
		reload: () => void reload(),
		loadMore: () => void loadMore(),
		selectOverviewEnvironment,
		showVulnerability,
		clearFocus,
		exportCSV: (id: EnvironmentID) => void exportCSV(id),
		shareExport,
		openFilter: () => nav.openFilter(listKey),
		openPatchTargets: (id: EnvironmentID) => nav.openPatchTargets(id),
		openFinding: (item: FindingItem) => nav.openFindingDetail(item.value),
		openImageVulnerabilities: (imageID: string, imageName: string) =>
			nav.openImageVulnerabilities(overviewEnvironmentID, imageID, imageName)
	};
}

export type AllVulnerabilitiesModel = ReturnType<typeof useAllVulnerabilities>;
