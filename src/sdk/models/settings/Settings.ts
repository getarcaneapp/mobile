export type SettingLockReason = 'env' | 'readOnly' | (string & {});

export interface PublicSetting {
	key: string;
	type: string;
	value: string;
	default?: string;
	source?: 'default' | 'db' | 'env' | (string & {});
	scope?: 'manager' | 'environment' | (string & {});
	locked?: boolean;
	lockReason?: SettingLockReason;
	sensitive?: boolean;
	envName?: string;
}

export const PublicSetting = {
	id(value: PublicSetting): string {
		return value.key;
	},
	isLocked(value: PublicSetting | undefined): boolean {
		return value?.locked === true;
	}
} as const;

export interface SettingDto {
	key: string;
	type: string;
	value: string;
	isPublic: boolean;
}

export const SettingDto = {
	id(value: SettingDto): string {
		return value.key;
	}
} as const;

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
