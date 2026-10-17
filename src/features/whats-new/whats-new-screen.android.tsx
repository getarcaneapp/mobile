/**
 * Android rendering of `WhatsNewPresentationView` / `WhatsNewArchiveView`
 * (Views/WhatsNew/WhatsNewView.swift) in Material 3: a sheet with a top app
 * bar (Previous Releases + Continue), the release's category sections, and an
 * in-sheet Previous Releases list that opens each older release.
 */
import { Stack } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ReleaseNoteBadge, ReleaseNoteBullet } from '@/release-notes';
import { colors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialListItem } from '@/ui/material/list';

import { useWhatsNewPresentation } from './use-whats-new';
import {
	badgeColor,
	badgeLabel,
	categoryTint,
	isAccessibilityTextSize,
	presentationSections,
	previousReleaseNotes,
	whatsNew as makeWhatsNew,
	type PresentationSection,
	type WhatsNewPresentation
} from './whats-new-model';

/** `undefined` = the release; `"archive"` = Previous Releases; otherwise an archived version. */
type ArchiveState = undefined | 'archive' | { version: string };

function TopBar({
	title,
	leading,
	trailing
}: {
	title: string;
	leading?: ReactNode;
	trailing?: ReactNode;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				minHeight: 64,
				paddingHorizontal: 4,
				gap: 4
			}}
		>
			<View style={{ minWidth: 48 }}>{leading}</View>
			<Text
				style={[m3Type.titleLarge, { flex: 1, color: colors.label }]}
				numberOfLines={1}
				accessibilityRole="header"
			>
				{title}
			</Text>
			<View style={{ minWidth: 48, alignItems: 'flex-end' }}>{trailing}</View>
		</View>
	);
}

function IconButton({
	name,
	label,
	onPress
}: {
	name: string;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{
				color: withOpacity(m3.onSurfaceVariant as string, 0.16),
				borderless: true,
				radius: 24
			}}
			style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
		>
			<Icon name={name} size={24} color={m3.onSurfaceVariant} />
		</Pressable>
	);
}

function FilledButton({ title, onPress }: { title: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: withOpacity('#FFFFFF', 0.2) }}
			style={{
				minHeight: 40,
				paddingHorizontal: 24,
				marginRight: 8,
				borderRadius: 20,
				justifyContent: 'center',
				backgroundColor: m3.primary,
				overflow: 'hidden'
			}}
		>
			<Text style={[m3Type.labelLarge, { color: m3.onPrimary }]}>{title}</Text>
		</Pressable>
	);
}

export function WhatsNewScreen() {
	const { whatsNew, dismiss } = useWhatsNewPresentation();
	const [archive, setArchive] = useState<ArchiveState>(undefined);

	// System back steps out of the archive before closing the sheet.
	useEffect(() => {
		if (archive === undefined) return;
		const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
			setArchive(archive === 'archive' ? undefined : 'archive');
			return true;
		});
		return () => subscription.remove();
	}, [archive]);

	if (!whatsNew) return null;
	const archived =
		typeof archive === 'object'
			? previousReleaseNotes.find((note) => note.version === archive.version)
			: undefined;

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: colors.systemBackground }} edges={['bottom']}>
			<Stack.Screen options={{ headerShown: false }} />
			{archive === undefined ? (
				<>
					<TopBar
						title=""
						leading={
							whatsNew.includesPreviousReleases ? (
								<IconButton
									name="clock.arrow.circlepath"
									label="Previous Releases"
									onPress={() => setArchive('archive')}
								/>
							) : null
						}
						trailing={<FilledButton title="Continue" onPress={dismiss} />}
					/>
					<ReleaseContent whatsNew={whatsNew} />
				</>
			) : archive === 'archive' ? (
				<>
					<TopBar
						title="Previous Releases"
						leading={
							<IconButton name="arrow.left" label="Back" onPress={() => setArchive(undefined)} />
						}
					/>
					<ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}>
						<MaterialListGroup>
							{previousReleaseNotes.map((note) => (
								<MaterialListItem
									key={note.version}
									headline={`Version ${note.version}`}
									trailing={<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />}
									onPress={() => setArchive({ version: note.version })}
								/>
							))}
						</MaterialListGroup>
					</ScrollView>
				</>
			) : (
				<>
					<TopBar
						title=""
						leading={
							<IconButton name="arrow.left" label="Back" onPress={() => setArchive('archive')} />
						}
					/>
					{archived ? <ReleaseContent whatsNew={makeWhatsNew(archived)} /> : null}
				</>
			)}
		</SafeAreaView>
	);
}

function ReleaseContent({ whatsNew }: { whatsNew: WhatsNewPresentation }) {
	const { fontScale } = useWindowDimensions();
	const isAccessibilitySize = isAccessibilityTextSize(fontScale);
	return (
		<ScrollView
			contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36, gap: 36 }}
		>
			<Text
				accessibilityRole="header"
				style={{
					fontSize: 32,
					lineHeight: 40,
					fontWeight: '700',
					textAlign: 'center',
					color: colors.label
				}}
			>
				{whatsNew.title}
			</Text>
			<View style={{ gap: 32 }}>
				{presentationSections(whatsNew.note).map((section) => (
					<FeatureRow
						key={section.category.key}
						section={section}
						isAccessibilitySize={isAccessibilitySize}
					/>
				))}
			</View>
		</ScrollView>
	);
}

function FeatureImage({ section }: { section: PresentationSection }) {
	const tint = categoryTint(section.category);
	return (
		<View
			style={{
				width: 32,
				height: 32,
				borderRadius: 16,
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: withOpacity(tint, 0.12)
			}}
		>
			<Icon name={section.category.systemImage} size={16} color={tint} />
		</View>
	);
}

function FeatureRow({
	section,
	isAccessibilitySize
}: {
	section: PresentationSection;
	isAccessibilitySize: boolean;
}) {
	if (isAccessibilitySize) {
		return (
			<View accessible style={{ gap: 12 }}>
				<FeatureImage section={section} />
				<FeatureText section={section} />
			</View>
		);
	}
	return (
		<View accessible style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
			<View style={{ width: 36 }}>
				<FeatureImage section={section} />
			</View>
			<FeatureText section={section} />
		</View>
	);
}

// Read per render: colors follow the current appearance.
const bulletText = () => [m3Type.bodyMedium, { color: colors.secondaryLabel }];

function FeatureText({ section }: { section: PresentationSection }) {
	return (
		<View style={{ flex: 1, gap: 8 }}>
			<Text style={[m3Type.titleMedium, { color: colors.label }]}>{section.category.title}</Text>
			<View style={{ gap: 8 }}>
				{section.bullets.map((bullet, index) => (
					<BulletRow key={index} bullet={bullet} />
				))}
			</View>
		</View>
	);
}

function BulletRow({ bullet }: { bullet: ReleaseNoteBullet }) {
	if (bullet.badge) return <BadgedReleaseNote text={bullet.text} badge={bullet.badge} />;
	return (
		<View style={{ flexDirection: 'row', gap: 8 }}>
			<Text style={[bulletText(), { color: colors.tertiaryLabel }]} importantForAccessibility="no">
				•
			</Text>
			<Text style={[bulletText(), { flex: 1 }]}>{bullet.text}</Text>
		</View>
	);
}

const legendHeight = 16;

/**
 * A badged release note drawn as a tinted block quote: the badge label sits
 * in the card's outline, cutting the line, and the note fills the card.
 */
function BadgedReleaseNote({ text, badge }: { text: string; badge: ReleaseNoteBadge }) {
	const color = badgeColor[badge];
	const label = badgeLabel[badge];
	return (
		<View accessible accessibilityLabel={`${label}: ${text}`} style={{ paddingTop: 6 }}>
			<View
				style={{
					paddingHorizontal: 12,
					paddingTop: 14,
					paddingBottom: 10,
					borderRadius: Radius.nested,
					borderCurve: 'continuous',
					borderWidth: 1,
					borderColor: withOpacity(color, 0.5),
					backgroundColor: withOpacity(color, 0.12)
				}}
			>
				<Text style={bulletText()}>{text}</Text>
			</View>
			{/* The legend's backdrop repeats the page above the edge and the tint below it, hiding the outline behind the label. */}
			<View
				style={{
					position: 'absolute',
					top: 6 - legendHeight / 2,
					left: 10,
					height: legendHeight,
					paddingHorizontal: 5,
					justifyContent: 'center',
					backgroundColor: colors.systemBackground
				}}
			>
				<View
					style={{
						position: 'absolute',
						left: 0,
						right: 0,
						bottom: 0,
						height: legendHeight / 2,
						backgroundColor: withOpacity(color, 0.12)
					}}
				/>
				<Text style={[m3Type.labelSmall, { color, fontWeight: '600', lineHeight: legendHeight }]}>
					{label}
				</Text>
			</View>
		</View>
	);
}
