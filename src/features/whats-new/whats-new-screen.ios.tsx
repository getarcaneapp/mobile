/**
 * Port of `WhatsNewPresentationView`, `WhatsNewReleaseContent`,
 * `BadgedReleaseNote` and `WhatsNewArchiveView` (Views/WhatsNew/WhatsNewView.swift).
 *
 * Standalone screen (draws its own SwiftUI navigation bar; presented as a sheet).
 * Previous Releases is a SwiftUI sheet over it with its own NavigationStack.
 */
import { Host } from '@/ui/host';
import {
	BottomSheet,
	Button,
	HStack,
	LazyVStack,
	List,
	Mask,
	NavigationDestination,
	NavigationLink,
	NavigationStack,
	Overlay,
	Rectangle,
	RoundedRectangle,
	ScrollView,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	background,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	listStyle,
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	navigationTitle,
	offset,
	onGeometryChange,
	padding,
	scrollEdgeEffectStyle,
	shapes,
	strokeBorder,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { ReleaseNoteBadge, ReleaseNoteBullet } from '@/release-notes';
import { useAccentColor } from '@/theme/accent';
import { withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Image } from '@/ui/components/swiftui-image';

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

const secondary = { type: 'hierarchical', style: 'secondary' } as const;
const tertiary = { type: 'hierarchical', style: 'tertiary' } as const;

export function WhatsNewScreen() {
	const accent = useAccentColor();
	const { whatsNew, dismiss } = useWhatsNewPresentation();
	const [showsArchive, setShowsArchive] = useState(false);
	if (!whatsNew) return null;

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack modifiers={[tint(accent)]}>
				<Toolbar>
					<VStack spacing={0}>
						<WhatsNewReleaseContent whatsNew={whatsNew} />
						<BottomSheet isPresented={showsArchive} onIsPresentedChange={setShowsArchive}>
							<WhatsNewArchiveView onDone={() => setShowsArchive(false)} />
						</BottomSheet>
					</VStack>
					<Toolbar.Content>
						{whatsNew.includesPreviousReleases ? (
							<ToolbarItem placement="topBarLeading">
								<Button
									label="Previous Releases"
									systemImage="clock.arrow.circlepath"
									onPress={() => setShowsArchive(true)}
									modifiers={[foregroundStyle(accent)]}
								/>
							</ToolbarItem>
						) : null}
						<ToolbarItem placement="confirmationAction">
							<Button label="Continue" onPress={dismiss} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}

function WhatsNewReleaseContent({
	whatsNew,
	inlineTitle = false
}: {
	whatsNew: WhatsNewPresentation;
	inlineTitle?: boolean;
}) {
	const { fontScale } = useWindowDimensions();
	const isAccessibilitySize = isAccessibilityTextSize(fontScale);
	return (
		<ScrollView
			modifiers={[
				scrollEdgeEffectStyle('soft', 'top'),
				...(inlineTitle ? [navigationBarTitleDisplayMode('inline')] : [])
			]}
		>
			<VStack
				spacing={36}
				modifiers={[padding({ horizontal: 20 }), padding({ top: 28 }), padding({ bottom: 36 })]}
			>
				<Text
					modifiers={[
						font({ textStyle: 'largeTitle', weight: 'bold' }),
						multilineTextAlignment('center'),
						frame({ maxWidth: Infinity })
					]}
				>
					{whatsNew.title}
				</Text>
				<LazyVStack alignment="leading" spacing={32}>
					{presentationSections(whatsNew.note).map((section) => (
						<FeatureRow
							key={section.category.key}
							section={section}
							isAccessibilitySize={isAccessibilitySize}
						/>
					))}
				</LazyVStack>
			</VStack>
		</ScrollView>
	);
}

/** `PresentationSection.feature.image`. */
function FeatureImage({ section, width }: { section: PresentationSection; width?: number }) {
	const tintColor = categoryTint(section.category);
	return (
		<Image
			systemName={section.category.systemImage as SFSymbol}
			modifiers={[
				font({ textStyle: 'subheadline', weight: 'bold' }),
				foregroundStyle(tintColor),
				frame({ width: 32, height: 32 }),
				background(withOpacity(tintColor, 0.12), shapes.circle()),
				...(width !== undefined ? [frame({ width })] : [])
			]}
		/>
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
			<VStack
				alignment="leading"
				spacing={12}
				modifiers={[
					frame({ maxWidth: Infinity, alignment: 'leading' }),
					accessibilityElement('combine')
				]}
			>
				<FeatureImage section={section} />
				<FeatureText section={section} />
			</VStack>
		);
	}
	return (
		<HStack alignment="top" spacing={14} modifiers={[accessibilityElement('combine')]}>
			<FeatureImage section={section} width={36} />
			<FeatureText section={section} />
		</HStack>
	);
}

function FeatureText({ section }: { section: PresentationSection }) {
	return (
		<VStack
			alignment="leading"
			spacing={8}
			modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
		>
			<Text modifiers={[font({ textStyle: 'headline' })]}>{section.category.title}</Text>
			<VStack
				alignment="leading"
				spacing={8}
				modifiers={[
					font({ textStyle: 'subheadline' }),
					foregroundStyle(secondary),
					fixedSize({ horizontal: false, vertical: true })
				]}
			>
				{section.bullets.map((bullet, index) => (
					<BulletRow key={index} bullet={bullet} />
				))}
			</VStack>
		</VStack>
	);
}

function BulletRow({ bullet }: { bullet: ReleaseNoteBullet }) {
	if (bullet.badge) return <BadgedReleaseNote text={bullet.text} badge={bullet.badge} />;
	return (
		<HStack alignment="firstTextBaseline" spacing={8}>
			<Text modifiers={[foregroundStyle(tertiary), accessibilityHidden(true)]}>•</Text>
			<Text>{bullet.text}</Text>
		</HStack>
	);
}

/**
 * A badged release note drawn as a tinted block quote: the badge label sits
 * in the card's outline, cutting the line, and the note fills the card.
 */
function BadgedReleaseNote({ text, badge }: { text: string; badge: ReleaseNoteBadge }) {
	const color = badgeColor[badge];
	const label = badgeLabel[badge];
	// Centered vertically on the card's top edge (`alignmentGuide(.top) { $0[.center] }`), inset 10 from the corner.
	const [legendSize, setLegendSize] = useState({ width: 0, height: 13 });
	const legend = (
		<Text
			modifiers={[
				font({ textStyle: 'caption2', weight: 'semibold' }),
				foregroundStyle(color),
				padding({ horizontal: 5 }),
				fixedSize(),
				onGeometryChange((frame) => setLegendSize({ width: frame.width, height: frame.height })),
				offset({ x: 10, y: -legendSize.height / 2 })
			]}
		>
			{label}
		</Text>
	);

	return (
		<Overlay
			alignment="topLeading"
			modifiers={[
				padding({ top: 6 }),
				accessibilityElement('ignore'),
				accessibilityLabel(`${label}: ${text}`)
			]}
		>
			<Overlay>
				<Text
					modifiers={[
						frame({ maxWidth: Infinity, alignment: 'leading' }),
						padding({ horizontal: 12 }),
						padding({ top: 14 }),
						padding({ bottom: 10 }),
						background(
							withOpacity(color, 0.12),
							shapes.roundedRectangle({
								cornerRadius: Radius.nested,
								roundedCornerStyle: 'continuous'
							})
						)
					]}
				>
					{text}
				</Text>
				<Overlay.Content>
					{/*
					 * The label hides the outline behind it so the text interrupts the line.
					 * Swift cuts it with `.blendMode(.destinationOut)`; @expo/ui has no blend
					 * modes, so the mask leaves a clear gap where the label's lower half sits.
					 */}
					<Mask>
						<RoundedRectangle
							cornerRadius={Radius.nested}
							modifiers={[
								foregroundStyle('#00000000'),
								strokeBorder({
									content: withOpacity(color, 0.5),
									style: { lineWidth: 1 },
									shape: 'roundedRectangle',
									cornerRadius: Radius.nested
								})
							]}
						/>
						<Mask.Content>
							<VStack spacing={0}>
								<HStack spacing={0} modifiers={[frame({ height: legendSize.height / 2 })]}>
									<Rectangle modifiers={[frame({ width: 10 })]} />
									<Rectangle
										modifiers={[foregroundStyle('#00000000'), frame({ width: legendSize.width })]}
									/>
									<Rectangle />
								</HStack>
								<Rectangle />
							</VStack>
						</Mask.Content>
					</Mask>
				</Overlay.Content>
			</Overlay>
			<Overlay.Content>{legend}</Overlay.Content>
		</Overlay>
	);
}

function WhatsNewArchiveView({ onDone }: { onDone: () => void }) {
	const accent = useAccentColor();
	const [path, setPath] = useState<string[]>([]);
	return (
		<NavigationStack path={path} onPathChange={setPath} modifiers={[tint(accent)]}>
			<Toolbar>
				<List
					modifiers={[
						listStyle('insetGrouped'),
						navigationTitle('Previous Releases'),
						navigationBarTitleDisplayMode('inline')
					]}
				>
					{previousReleaseNotes.map((note) => (
						<NavigationLink key={note.version} value={note.version}>
							<Text>{`Version ${note.version}`}</Text>
						</NavigationLink>
					))}
				</List>
				<Toolbar.Content>
					<ToolbarItem placement="confirmationAction">
						<Button label="Done" onPress={onDone} />
					</ToolbarItem>
				</Toolbar.Content>
			</Toolbar>
			{path.map((value) => {
				const note = previousReleaseNotes.find((candidate) => candidate.version === value);
				return note ? (
					<NavigationDestination key={value} value={value}>
						<WhatsNewReleaseContent whatsNew={makeWhatsNew(note)} inlineTitle />
					</NavigationDestination>
				) : null;
			})}
		</NavigationStack>
	);
}
