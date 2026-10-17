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

type Version = { major: number; minor: number; patch: number };

function parseVersion(value: string): Version {
	const components = value
		.split('.')
		.filter((part) => /^[+-]?\d+$/.test(part))
		.map((part) => Number.parseInt(part, 10));
	return { major: components[0] ?? 0, minor: components[1] ?? 0, patch: components[2] ?? 0 };
}

const describe = (version: Version) => `${version.major}.${version.minor}.${version.patch}`;

export const versionDescription = (value: string) => describe(parseVersion(value));

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

export type ReleaseNoteCategory = (typeof releaseNoteCategories)[number];

export type PresentationSection = {
	category: ReleaseNoteCategory;
	bullets: ReleaseNoteBullet[];
};

export const categoryTint = (category: ReleaseNoteCategory) => systemColors[category.tint];

export const badgeLabel: Record<ReleaseNoteBadge, string> = {
	premium: 'Premium',
	preview: 'Preview'
};
export const badgeColor: Record<ReleaseNoteBadge, string> = {
	premium: systemColors.purple,
	preview: systemColors.blue
};

export function presentationSections(note: ReleaseNote): PresentationSection[] {
	return releaseNoteCategories
		.map((category) => ({ category, bullets: note[category.key] ?? [] }))
		.filter((section) => section.bullets.length > 0);
}

export type WhatsNewPresentation = {
	note: ReleaseNote;
	version: string;
	title: string;
	includesPreviousReleases: boolean;
};

export function whatsNew(
	note: ReleaseNote,
	includesPreviousReleases = false
): WhatsNewPresentation {
	const version = versionDescription(note.version);
	return { note, version, title: `What's New in ${note.version}`, includesPreviousReleases };
}

export const latestReleaseNote: ReleaseNote | undefined = releaseNotes[0];
export const previousReleaseNotes: ReleaseNote[] = releaseNotes.slice(1);

const whatsNewCollection = (): WhatsNewPresentation[] =>
	releaseNotes.map((note, index) => whatsNew(note, index === 0 && previousReleaseNotes.length > 0));

export function latestWhatsNew(): WhatsNewPresentation | undefined {
	return latestReleaseNote
		? whatsNew(latestReleaseNote, previousReleaseNotes.length > 0)
		: undefined;
}

export function whatsNewForVersion(version: string): WhatsNewPresentation | undefined {
	const description = versionDescription(version);
	return whatsNewCollection().find((entry) => entry.version === description);
}

export const legacyLastSeenVersionKey = 'arcane.lastSeenReleaseVersion';

export function migrateLegacyPresentation(): string | undefined {
	const legacyVersion = storage.string(legacyLastSeenVersionKey);
	if (legacyVersion === undefined) return undefined;
	storage.remove(legacyLastSeenVersionKey);
	if (!releaseNotes.some((note) => note.version === legacyVersion)) return undefined;
	WhatsNewVersionStore.save(legacyVersion);
	return versionDescription(legacyVersion);
}

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

export const isAccessibilityTextSize = (fontScale: number = PixelRatio.getFontScale()) =>
	fontScale >= 1.6;
