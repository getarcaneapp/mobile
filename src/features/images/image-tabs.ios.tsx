import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { Button, HStack, List, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	contentShape,
	font,
	foregroundStyle,
	frame,
	listStyle,
	monospacedDigit,
	opacity,
	padding,
	refreshable,
	shapes,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';

import type { EnvironmentID } from '@/sdk/client/environment';
import type { ImageAttestation } from '@/sdk/models/image/ImageAttestation';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { MonospacedValue } from '@/ui/components/resource-detail';
import { RowIcon } from '@/ui/components/row-icon';

import { byteString, predicateIconName, shortPredicateName } from './image-model';
import {
	historyDate,
	layerID,
	useImageHistory,
	type ImageAttestationsModel
} from './use-image-tabs';

function Unavailable({
	title,
	systemImage,
	description,
	action
}: {
	title: string;
	systemImage: string;
	description: string;
	action?: { title: string; onPress: () => void };
}) {
	return (
		<UnavailableView
			title={title}
			systemImage={systemImage as never}
			description={description}
			actions={action ? [{ title: action.title, onPress: action.onPress }] : []}
		/>
	);
}

export function ImageHistoryView({
	environmentID,
	imageID
}: {
	environmentID: EnvironmentID;
	imageID: string;
}) {
	const { items, isLoading, errorMessage, load } = useImageHistory(environmentID, imageID);
	let content;
	if (isLoading && items.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (errorMessage !== undefined && items.length === 0) {
		content = (
			<Unavailable
				title="Couldn't Load History"
				systemImage="exclamationmark.triangle"
				description={errorMessage}
				action={{ title: 'Try Again', onPress: () => void load() }}
			/>
		);
	} else if (items.length === 0) {
		content = (
			<Unavailable
				title="No Layer History"
				systemImage="square.stack.3d.down.right"
				description="This image did not return any layer history."
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(load)]}>
				{items.map((item, index) => (
					<VStack
						key={`${item.id}-${index}`}
						alignment="leading"
						spacing={7}
						modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
					>
						<HStack>
							<MonospacedValue value={layerID(item.id)} lineLimit={1} />
							<Spacer minLength={8} />
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									monospacedDigit(),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{byteString(item.size)}
							</Text>
						</HStack>
						{item.createdBy !== '' ? <MonospacedValue value={item.createdBy} /> : null}
						<HStack
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{item.created > 0 ? <Text>{historyDate(item.created)}</Text> : null}
							{item.tags.length > 0 ? <Text>{item.tags.join(', ')}</Text> : null}
						</HStack>
					</VStack>
				))}
			</List>
		);
	}
	return <Host style={{ flex: 1 }}>{content}</Host>;
}

const hierarchicalSecondary = { type: 'hierarchical', style: 'secondary' } as const;

function AttestationRow({ attestation }: { attestation: ImageAttestation }) {
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 2 }), contentShape(shapes.rectangle())]}>
			<RowIcon
				systemImage={predicateIconName(attestation.predicateType)}
				tint={systemColors.indigo}
			/>
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
					{shortPredicateName(attestation.predicateType)}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption2', design: 'monospaced' }),
						foregroundStyle(hierarchicalSecondary),
						truncationMode('middle')
					]}
				>
					{attestation.predicateType}
				</Text>
			</VStack>
			<Spacer />
			<VStack alignment="trailing" spacing={3}>
				{attestation.platform !== undefined ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2', design: 'monospaced' }),
							foregroundStyle(hierarchicalSecondary)
						]}
					>
						{attestation.platform}
					</Text>
				) : null}
				<Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(hierarchicalSecondary)]}>
					{byteString(attestation.size)}
				</Text>
			</VStack>
			<Image
				systemName="chevron.right"
				modifiers={[
					font({ textStyle: 'caption2', weight: 'bold' }),
					foregroundStyle(hierarchicalSecondary),
					opacity(0.5)
				]}
			/>
		</HStack>
	);
}

export function ImageAttestationsView({
	model,
	onOpen
}: {
	model: ImageAttestationsModel;
	onOpen: (attestation: ImageAttestation) => void;
}) {
	const { result, isLoading, errorMessage, attestations, selectedPredicateType } = model;
	let content;
	if (isLoading && result === undefined) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (errorMessage !== undefined && result === undefined) {
		content = (
			<Unavailable
				title="Couldn't Load Attestations"
				systemImage="exclamationmark.triangle"
				description={errorMessage}
				action={{ title: 'Try Again', onPress: () => void model.load() }}
			/>
		);
	} else if (attestations.length === 0 && selectedPredicateType === undefined) {
		content = (
			<Unavailable
				title="No Attestations"
				systemImage="checkmark.seal"
				description="This image has no in-toto attestations attached (provenance, SBOM, …)."
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.load)]}>
				{attestations.map((attestation) => (
					<Button key={attestation.digest} onPress={() => onOpen(attestation)}>
						<AttestationRow attestation={attestation} />
					</Button>
				))}
				{result?.subjectDigest ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2', design: 'monospaced' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							frame({ maxWidth: Infinity, alignment: 'leading' }),
							padding({ horizontal: 4 })
						]}
					>
						{`Subject digest: ${result.subjectDigest}`}
					</Text>
				) : null}
			</List>
		);
	}
	return <Host style={{ flex: 1 }}>{content}</Host>;
}
