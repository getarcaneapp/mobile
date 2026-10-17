import { mobilePushFeature } from '../../client/ServerCapabilities';

export interface VersionInfo {
	currentVersion: string;
	currentTag?: string;
	currentDigest?: string;
	revision: string;
	shortRevision: string;
	goVersion: string;
	enabledFeatures?: string[];
	buildTime?: string;
	displayVersion: string;
	isSemverVersion: boolean;
	newestVersion?: string;
	newestDigest?: string;
	updateAvailable: boolean;
	releaseUrl?: string;
	releaseNotes?: string;
	releasedAt?: string;
}

interface SemanticVersion {
	major: number;
	minor: number;
	patch: number;
}

function firstSplit(value: string, separator: string): string | undefined {
	let start = 0;
	while (value.startsWith(separator, start)) start += separator.length;
	const rest = value.slice(start);
	if (rest === '') return undefined;
	const index = rest.indexOf(separator);
	return index < 0 ? rest : rest.slice(0, index);
}

function parseSwiftInt(value: string): number | undefined {
	return /^[+-]?\d+$/.test(value) ? Number(value) : undefined;
}

function parseSemanticVersion(rawValue: string): SemanticVersion | undefined {
	let value = rawValue.trim();
	if (value.startsWith('v')) value = value.slice(1);
	const plus = firstSplit(value, '+');
	if (plus === undefined) return undefined;
	const core = firstSplit(plus, '-');
	if (core === undefined) return undefined;
	const components = core.split('.');
	if (components.length !== 3) return undefined;
	const [major, minor, patch] = components.map(parseSwiftInt);
	if (major === undefined || minor === undefined || patch === undefined) return undefined;
	if (major < 0 || minor < 0 || patch < 0) return undefined;
	return { major, minor, patch };
}

function compareSemanticVersion(lhs: SemanticVersion, rhs: SemanticVersion): number {
	if (lhs.major !== rhs.major) return lhs.major - rhs.major;
	if (lhs.minor !== rhs.minor) return lhs.minor - rhs.minor;
	return lhs.patch - rhs.patch;
}

export const VersionInfo = {
	supportsMobilePush(value: VersionInfo): boolean {
		return (value.enabledFeatures ?? []).some(
			(feature) => feature.toLowerCase() === mobilePushFeature
		);
	},

	supportsPost26MobileFeatures(value: VersionInfo): boolean {
		if (!value.isSemverVersion) return false;
		const version = parseSemanticVersion(value.currentVersion);
		if (!version) return false;
		return compareSemanticVersion(version, { major: 2, minor: 7, patch: 0 }) >= 0;
	}
} as const;

export interface VersionCheck {
	currentVersion: string;
	newestVersion?: string;
	updateAvailable: boolean;
	releaseUrl?: string;
}
