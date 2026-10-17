/** Port of `ImageUpdatesView` and `UpdateRow` (ImageUpdatesView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	Label,
	LabeledContent,
	List,
	ProgressView,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	lineLimit,
	listStyle,
	refreshable,
	scaleEffect,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import type { ImageUpdateResponse } from '@/sdk/models/imageUpdate/ImageUpdate';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { imageReferenceParts } from '@/ui/components/image-reference';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { ImageReferenceName, TagChip } from '@/ui/components/row-icon';

import { updateVersionLine } from './image-model';
import { useImageUpdates } from './use-image-updates';

function UpdateRow({
	refName,
	info,
	isChecking,
	recheck
}: {
	refName: string;
	info?: ImageUpdateResponse;
	isChecking: boolean;
	recheck: () => void;
}) {
	const parts = imageReferenceParts(refName);
	let status;
	if (info) {
		if (info.error !== undefined && info.error !== '') {
			status = (
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle(systemColors.red),
						lineLimit(2)
					]}
				>
					{info.error}
				</Text>
			);
		} else if (info.hasUpdate) {
			status = (
				<HStack spacing={6}>
					<Image
						systemName="arrow.up.circle.fill"
						modifiers={[foregroundStyle(systemColors.orange)]}
					/>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{updateVersionLine(info)}
					</Text>
				</HStack>
			);
		} else {
			status = (
				<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(systemColors.green)]}>
					Up to date
				</Text>
			);
		}
	} else {
		status = (
			<Text
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				Not yet checked
			</Text>
		);
	}
	return (
		<HStack spacing={12}>
			<VStack alignment="leading" spacing={3}>
				<HStack spacing={6}>
					<HStack modifiers={[lineLimit(1), truncationMode('head')]}>
						<ImageReferenceName reference={parts} textStyle="subheadline" />
					</HStack>
					{parts.tag ? <TagChip text={parts.tag} /> : null}
				</HStack>
				{status}
			</VStack>
			<Spacer />
			{isChecking ? (
				<ProgressView modifiers={[scaleEffect(0.8)]} />
			) : (
				<Button onPress={recheck} modifiers={[buttonStyle('borderless')]}>
					<Image systemName="arrow.clockwise" />
				</Button>
			)}
		</HStack>
	);
}

export function ImageUpdatesScreen() {
	const model = useImageUpdates();
	const { summary } = model;
	return (
		<>
			<Stack.Screen options={{ title: 'Updates', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped'), refreshable(model.reload)]}>
					<Section title="Summary">
						{summary ? (
							<>
								<LabeledContent label="Total">
									<Text>{String(summary.totalImages)}</Text>
								</LabeledContent>
								<LabeledContent label="With updates">
									<Text
										modifiers={[
											foregroundStyle(
												summary.imagesWithUpdates > 0 ? systemColors.orange : 'secondary'
											)
										]}
									>
										{String(summary.imagesWithUpdates)}
									</Text>
								</LabeledContent>
								<LabeledContent label="Digest">
									<Text>{String(summary.digestUpdates)}</Text>
								</LabeledContent>
								<LabeledContent label="Errors">
									<Text
										modifiers={[
											foregroundStyle(summary.errorsCount > 0 ? systemColors.red : 'secondary')
										]}
									>
										{String(summary.errorsCount)}
									</Text>
								</LabeledContent>
							</>
						) : model.loadingSummary ? (
							<ArcaneLoadingViewSwiftUI label="Loading summary…" />
						) : (
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								No summary available
							</Text>
						)}
					</Section>
					<Section
						footer={
							<Text>Contacts each image's registry. Can take a while for large environments.</Text>
						}
					>
						<Button onPress={model.scanAll} modifiers={[disabled(model.isScanning)]}>
							<HStack>
								<Label title="Scan all images" systemImage="magnifyingglass" />
								<Spacer minLength={8} />
								{model.isScanning ? <ProgressView modifiers={[controlSize('small')]} /> : null}
							</HStack>
						</Button>
					</Section>
					{model.taggedRefs.length > 0 ? (
						<Section
							header={
								<ResourceCountSectionHeader title="Images" loadedCount={model.taggedRefs.length} />
							}
						>
							{model.taggedRefs.map((ref, index) => (
								<UpdateRow
									key={`${ref}-${index}`}
									refName={ref}
									info={model.byRef[ref]}
									isChecking={model.checkingRef === ref}
									recheck={() => model.recheck(ref)}
								/>
							))}
						</Section>
					) : null}
					{model.errorMessage ? (
						<Section>
							<Label
								title={model.errorMessage}
								systemImage="exclamationmark.triangle"
								modifiers={[foregroundStyle(systemColors.red)]}
							/>
						</Section>
					) : null}
				</List>
			</Host>
		</>
	);
}
