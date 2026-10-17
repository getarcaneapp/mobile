/**
 * What's New data model: the presentation half of `ReleaseNotes.swift`
 * (`PresentationSection`, `whatsNew(includesPreviousReleases:)`,
 * `makeWhatsNewEnvironment`, `migrateLegacyPresentation`) plus the parts of
 * WhatsNewKit the app relies on (`WhatsNew.Version`,
 * `UserDefaultsWhatsNewVersionStore`, `WhatsNewEnvironment.whatsNew()`).
 *
 * Presented versions use WhatsNewKit's UserDefaults layout (`WhatsNewKit.<version>`
 * keys holding the version string), so the stored state matches the Swift app.
 */
import * as Application from 'expo-application';
import { PixelRatio } from 'react-native';

import { defaults, storage } from '@/core/storage';
import {
	releaseNoteCategories,
	releaseNotes,
	type ReleaseNote,
	type ReleaseNoteBadge,
	type ReleaseNoteBullet
} from '@/release-notes';
import { systemColors } from '@/theme/colors';

// MARK: - WhatsNew.Version

type Version = { major: number; minor: number; patch: number };

/** `WhatsNew.Version(stringLiteral:)`: dot-separated integers, missing parts are 0. */
function parseVersion(value: string): Version {
	const components = value
		.split('.')
		.filter((part) => /^[+-]?\d+$/.test(part))
		.map((part) => Number.parseInt(part, 10));
	return { major: components[0] ?? 0, minor: components[1] ?? 0, patch: components[2] ?? 0 };
}

const describe = (version: Version) => `${version.major}.${version.minor}.${version.patch}`;

/** `WhatsNew.Version.description` of a version string ("0.1" → "0.1.0"). */
export const versionDescription = (value: string) => describe(parseVersion(value));

// MARK: - UserDefaultsWhatsNewVersionStore

const versionKeyPrefix = 'WhatsNewKit';
const versionKey = (description: string) => `${versionKeyPrefix}.${description}`;

export const WhatsNewVersionStore = {
	presentedVersions(): string[] {
		return defaults
			.getAllKeys()
			.filter((key) => key.startsWith(versionKeyPrefix))
			.map((key) => defaults.getString(key))
			.filter((value): value is string => value !== undefined)
			.map(versionDescription);
	},
	save(presentedVersion: string) {
		const description = versionDescription(presentedVersion);
		storage.set(versionKey(description), description);
	}
};

// MARK: - ReleaseNote presentation

export type ReleaseNoteCategory = (typeof releaseNoteCategories)[number];

export type PresentationSection = {
	category: ReleaseNoteCategory;
	bullets: ReleaseNoteBullet[];
};

/** `ReleaseNote.Category.tint`. */
export const categoryTint = (category: ReleaseNoteCategory) => systemColors[category.tint];

/** `ReleaseNote.Badge.label` / `.color`. */
export const badgeLabel: Record<ReleaseNoteBadge, string> = {
	premium: 'Premium',
	preview: 'Preview'
};
export const badgeColor: Record<ReleaseNoteBadge, string> = {
	premium: systemColors.purple,
	preview: systemColors.blue
};

/** `ReleaseNote.presentationSections`: New, Changed, Removed, Fixed; empty ones dropped. */
export function presentationSections(note: ReleaseNote): PresentationSection[] {
	return releaseNoteCategories
		.map((category) => ({ category, bullets: note[category.key] ?? [] }))
		.filter((section) => section.bullets.length > 0);
}

/** The `WhatsNew` built by `ReleaseNote.whatsNew(includesPreviousReleases:)`. */
export type WhatsNewPresentation = {
	note: ReleaseNote;
	/** `WhatsNew.Version.description`. */
	version: string;
	title: string;
	/** Shows the "Previous Releases" secondary action. */
	includesPreviousReleases: boolean;
};

export function whatsNew(
	note: ReleaseNote,
	includesPreviousReleases = false
): WhatsNewPresentation {
	const version = versionDescription(note.version);
	return { note, version, title: `What's New in ${note.version}`, includesPreviousReleases };
}

// MARK: - ReleaseNotes

export const latestReleaseNote: ReleaseNote | undefined = releaseNotes[0];
export const previousReleaseNotes: ReleaseNote[] = releaseNotes.slice(1);

const whatsNewCollection = (): WhatsNewPresentation[] =>
	releaseNotes.map((note, index) => whatsNew(note, index === 0 && previousReleaseNotes.length > 0));

/** `ReleaseNotes.latestWhatsNew` (More → What's New). */
export function latestWhatsNew(): WhatsNewPresentation | undefined {
	return latestReleaseNote
		? whatsNew(latestReleaseNote, previousReleaseNotes.length > 0)
		: undefined;
}

/** The collection entry for a version description (the automatic presentation's route param). */
export function whatsNewForVersion(version: string): WhatsNewPresentation | undefined {
	const description = versionDescription(version);
	return whatsNewCollection().find((entry) => entry.version === description);
}

export const legacyLastSeenVersionKey = 'arcane.lastSeenReleaseVersion';

/** `ReleaseNotes.migrateLegacyPresentation(in:)`. */
export function migrateLegacyPresentation(): string | undefined {
	const legacyVersion = storage.string(legacyLastSeenVersionKey);
	if (legacyVersion === undefined) return undefined;
	storage.remove(legacyLastSeenVersionKey);
	if (!releaseNotes.some((note) => note.version === legacyVersion)) return undefined;
	WhatsNewVersionStore.save(legacyVersion);
	return versionDescription(legacyVersion);
}

/** `WhatsNewEnvironment.whatsNew()`: the release to show automatically, if not yet presented. */
export function automaticWhatsNew(
	currentVersion: string = Application.nativeApplicationVersion ?? ''
): WhatsNewPresentation | undefined {
	const presented = new Set(WhatsNewVersionStore.presentedVersions());
	const current = parseVersion(currentVersion);
	const currentDescription = describe(current);
	if (presented.has(currentDescription)) return undefined;
	const collection = whatsNewCollection();
	const exact = collection.find((entry) => entry.version === currentDescription);
	if (exact) return exact;
	const minorDescription = describe({ ...current, patch: 0 });
	if (presented.has(minorDescription)) return undefined;
	return collection.find((entry) => entry.version === minorDescription);
}

/** `dynamicTypeSize.isAccessibilitySize` (AX1 body is ~1.65× the default size). */
export const isAccessibilityTextSize = (fontScale: number = PixelRatio.getFontScale()) =>
	fontScale >= 1.6;
