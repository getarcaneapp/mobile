/** Port of Models/Settings/Settings.swift. */

/** A publicly accessible setting value. */
export interface PublicSetting {
	key: string;
	type: string;
	value: string;
}

export const PublicSetting = {
	/** Swift `Identifiable.id`. */
	id(value: PublicSetting): string {
		return value.key;
	}
} as const;

/** A setting value with visibility metadata. */
export interface SettingDto {
	key: string;
	type: string;
	value: string;
	isPublic: boolean;
}

export const SettingDto = {
	/** Swift `Identifiable.id`. */
	id(value: SettingDto): string {
		return value.key;
	}
} as const;

/**
 * Request body for `PUT /environments/{id}/settings`.
 *
 * All fields are optional strings — only the fields you set are updated.
 */
export interface UpdateSettings {
	projectsDirectory?: string;
	followProjectSymlinks?: string;
	swarmStackSourcesDirectory?: string;
	diskUsagePath?: string;
	autoUpdate?: string;
	autoUpdateInterval?: string;
	pollingEnabled?: string;
	pollingInterval?: string;
	dockerClientRefreshInterval?: string;
	autoInjectEnv?: string;
	environmentHealthInterval?: string;
	dockerPruneMode?: string;
	defaultDeployPullPolicy?: string;
	scheduledPruneEnabled?: string;
	scheduledPruneInterval?: string;
	scheduledPruneContainers?: string;
	scheduledPruneImages?: string;
	scheduledPruneVolumes?: string;
	scheduledPruneNetworks?: string;
	scheduledPruneBuildCache?: string;
	pruneContainerMode?: string;
	pruneContainerUntil?: string;
	pruneImageMode?: string;
	pruneImageUntil?: string;
	pruneVolumeMode?: string;
	pruneNetworkMode?: string;
	pruneNetworkUntil?: string;
	pruneBuildCacheMode?: string;
	pruneBuildCacheUntil?: string;
	vulnerabilityScanEnabled?: string;
	vulnerabilityScanInterval?: string;
	maxImageUploadSize?: string;
	gitSyncMaxFiles?: string;
	gitSyncMaxTotalSizeMb?: string;
	gitSyncMaxBinarySizeMb?: string;
	baseServerUrl?: string;
	enableGravatar?: string;
	defaultShell?: string;
	dockerHost?: string;
	accentColor?: string;
	applicationTheme?: string;
	authLocalEnabled?: string;
	oidcEnabled?: string;
	oidcMergeAccounts?: string;
	authSessionTimeout?: string;
	authPasswordPolicy?: string;
	trivyImage?: string;
	trivyNetwork?: string;
	trivySecurityOpts?: string;
	trivyPrivileged?: string;
	trivyPreserveCacheOnVolumePrune?: string;
	trivyResourceLimitsEnabled?: string;
	trivyCpuLimit?: string;
	trivyMemoryLimitMb?: string;
	trivyConcurrentScanContainers?: string;
	trivyConfig?: string;
	trivyIgnore?: string;
	authOidcConfig?: string;
	oidcClientId?: string;
	oidcClientSecret?: string;
	oidcIssuerUrl?: string;
	oidcScopes?: string;
	oidcAdminClaim?: string;
	oidcAdminValue?: string;
	oidcSkipTlsVerify?: string;
	oidcAutoRedirectToProvider?: string;
	oidcProviderName?: string;
	oidcProviderLogoUrl?: string;
	mobileNavigationMode?: string;
	mobileNavigationShowLabels?: string;
	sidebarHoverExpansion?: string;
	keyboardShortcutsEnabled?: string;
	dockerApiTimeout?: string;
	dockerImagePullTimeout?: string;
	trivyScanTimeout?: string;
	gitOperationTimeout?: string;
	httpClientTimeout?: string;
	registryTimeout?: string;
	proxyRequestTimeout?: string;
	autoUpdateExcludedContainers?: string;
	autoHealEnabled?: string;
	autoHealInterval?: string;
	autoHealExcludedContainers?: string;
	autoHealMaxRestarts?: string;
	autoHealRestartWindow?: string;
	buildProvider?: string;
	buildsDirectory?: string;
	buildTimeout?: string;
	depotProjectId?: string;
	depotToken?: string;
	oledMode?: string;
}
