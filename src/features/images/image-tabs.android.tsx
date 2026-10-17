/** Android ports of `ImageHistoryView` and `ImageAttestationsView`. */
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { CenteredMessage } from '@/features/containers/android-material';
import type { EnvironmentID } from '@/sdk/client/environment';
import type { ImageAttestation } from '@/sdk/models/image/ImageAttestation';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { byteString, predicateIconName, shortPredicateName } from './image-model';
import {
	historyDate,
	layerID,
	useImageHistory,
	type ImageAttestationsModel
} from './use-image-tabs';

function Loading() {
	return (
		<View
			style={{
				flex: 1,
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: colors.systemGroupedBackground
			}}
		>
			<ArcaneLoadingView label="Loading…" />
		</View>
	);
}

function RefreshableList({
	onRefresh,
	children
}: {
	onRefresh: () => Promise<void>;
	children: React.ReactNode;
}) {
	const [refreshing, setRefreshing] = useState(false);
	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => {
						setRefreshing(true);
						void onRefresh().finally(() => setRefreshing(false));
					}}
				/>
			}
		>
			{children}
		</ScrollView>
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
	if (isLoading && items.length === 0) return <Loading />;
	if (errorMessage !== undefined && items.length === 0) {
		return (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load History"
				message={errorMessage}
				action={{ title: 'Try Again', onPress: () => void load() }}
			/>
		);
	}
	if (items.length === 0) {
		return (
			<CenteredMessage
				icon="square.stack.3d.down.right"
				title="No Layer History"
				message="This image did not return any layer history."
			/>
		);
	}
	return (
		<RefreshableList onRefresh={load}>
			<MaterialListGroup>
				{items.map((item, index) => (
					<View
						key={`${item.id}-${index}`}
						style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 7 }}
					>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
							<Text
								numberOfLines={1}
								ellipsizeMode="middle"
								style={{ flex: 1, fontFamily: monoFamily, fontSize: 15, color: colors.label }}
							>
								{layerID(item.id)}
							</Text>
							<Text
								style={[
									m3Type.bodySmall,
									{ color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }
								]}
							>
								{byteString(item.size)}
							</Text>
						</View>
						{item.createdBy !== '' ? (
							<Text
								selectable
								style={{ fontFamily: monoFamily, fontSize: 14, color: colors.label }}
							>
								{item.createdBy}
							</Text>
						) : null}
						<View style={{ flexDirection: 'row', gap: 8 }}>
							{item.created > 0 ? (
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
									{historyDate(item.created)}
								</Text>
							) : null}
							{item.tags.length > 0 ? (
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
									{item.tags.join(', ')}
								</Text>
							) : null}
						</View>
					</View>
				))}
			</MaterialListGroup>
		</RefreshableList>
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
	if (isLoading && result === undefined) return <Loading />;
	if (errorMessage !== undefined && result === undefined) {
		return (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Attestations"
				message={errorMessage}
				action={{ title: 'Try Again', onPress: () => void model.load() }}
			/>
		);
	}
	if (attestations.length === 0 && selectedPredicateType === undefined) {
		return (
			<CenteredMessage
				icon="checkmark.seal"
				title="No Attestations"
				message="This image has no in-toto attestations attached (provenance, SBOM, …)."
			/>
		);
	}
	return (
		<RefreshableList onRefresh={model.load}>
			<MaterialListGroup>
				{attestations.map((attestation) => (
					<Pressable
						key={attestation.digest}
						onPress={() => onOpen(attestation)}
						accessibilityRole="button"
						android_ripple={{ color: colors.separator as string }}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 12,
							paddingHorizontal: 16,
							paddingVertical: 10
						}}
					>
						<RowIcon
							systemImage={predicateIconName(attestation.predicateType)}
							tint={systemColors.indigo}
						/>
						<View style={{ flex: 1, gap: 3 }}>
							<Text style={[m3Type.titleSmall, { color: colors.label }]}>
								{shortPredicateName(attestation.predicateType)}
							</Text>
							<Text
								numberOfLines={1}
								ellipsizeMode="middle"
								style={{ fontFamily: monoFamily, fontSize: 11, color: colors.secondaryLabel }}
							>
								{attestation.predicateType}
							</Text>
						</View>
						<View style={{ alignItems: 'flex-end', gap: 3 }}>
							{attestation.platform !== undefined ? (
								<Text
									style={{ fontFamily: monoFamily, fontSize: 11, color: colors.secondaryLabel }}
								>
									{attestation.platform}
								</Text>
							) : null}
							<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
								{byteString(attestation.size)}
							</Text>
						</View>
						<Icon name="chevron.right" size={14} color={colors.tertiaryLabel} />
					</Pressable>
				))}
			</MaterialListGroup>
			{result?.subjectDigest ? (
				<Text
					selectable
					style={{
						fontFamily: monoFamily,
						fontSize: 11,
						color: colors.secondaryLabel,
						paddingHorizontal: 20,
						paddingTop: 12
					}}
				>
					{`Subject digest: ${result.subjectDigest}`}
				</Text>
			) : null}
		</RefreshableList>
	);
}
