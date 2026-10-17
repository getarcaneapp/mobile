import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { M3Section, ValueRow } from '@/features/containers/android-material';
import type { ImageUpdateResponse } from '@/sdk/models/imageUpdate/ImageUpdate';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { imageReferenceParts } from '@/ui/components/image-reference';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { TagChip } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

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
				<Text numberOfLines={2} style={[m3Type.labelSmall, { color: systemColors.red }]}>
					{info.error}
				</Text>
			);
		} else if (info.hasUpdate) {
			status = (
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
					<Icon name="arrow.up.circle.fill" size={14} color={systemColors.orange} />
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{updateVersionLine(info)}
					</Text>
				</View>
			);
		} else {
			status = <Text style={[m3Type.bodySmall, { color: systemColors.green }]}>Up to date</Text>;
		}
	} else {
		status = (
			<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>Not yet checked</Text>
		);
	}
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<View style={{ flex: 1, gap: 3 }}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
					<Text
						numberOfLines={1}
						ellipsizeMode="head"
						style={[m3Type.bodyMedium, { color: colors.label, flexShrink: 1 }]}
					>
						<Text style={{ color: colors.secondaryLabel }}>{parts.namespace}</Text>
						{parts.name}
					</Text>
					{parts.tag ? <TagChip text={parts.tag} /> : null}
				</View>
				{status}
			</View>
			{isChecking ? (
				<ActivityIndicator size="small" />
			) : (
				<Pressable
					onPress={recheck}
					accessibilityRole="button"
					accessibilityLabel="Recheck"
					hitSlop={8}
					android_ripple={{ color: colors.separator as string, borderless: true }}
				>
					<Icon name="arrow.clockwise" size={20} color={m3.primary} />
				</Pressable>
			)}
		</View>
	);
}

export function ImageUpdatesScreen() {
	const model = useImageUpdates();
	const { summary } = model;
	const [refreshing, setRefreshing] = useState(false);
	return (
		<>
			<Stack.Screen options={{ title: 'Updates' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.reload().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				<M3Section title="Summary">
					{summary ? (
						<>
							<ValueRow title="Total" value={String(summary.totalImages)} />
							<ValueRow
								title="With updates"
								value={String(summary.imagesWithUpdates)}
								valueColor={summary.imagesWithUpdates > 0 ? systemColors.orange : undefined}
							/>
							<ValueRow title="Digest" value={String(summary.digestUpdates)} />
							<ValueRow
								title="Errors"
								value={String(summary.errorsCount)}
								valueColor={summary.errorsCount > 0 ? systemColors.red : undefined}
							/>
						</>
					) : model.loadingSummary ? (
						<View style={{ padding: 16 }}>
							<ArcaneLoadingView label="Loading summary…" />
						</View>
					) : (
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, padding: 16 }]}>
							No summary available
						</Text>
					)}
				</M3Section>
				<M3Section footer="Contacts each image's registry. Can take a while for large environments.">
					<Pressable
						onPress={model.scanAll}
						disabled={model.isScanning}
						accessibilityRole="button"
						android_ripple={{ color: colors.separator as string }}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 16,
							minHeight: 52,
							paddingHorizontal: 16,
							opacity: model.isScanning ? 0.5 : 1
						}}
					>
						<Icon name="magnifyingglass" size={20} color={m3.primary} />
						<Text style={[m3Type.bodyLarge, { color: m3.primary, flex: 1 }]}>Scan all images</Text>
						{model.isScanning ? <ActivityIndicator size="small" /> : null}
					</Pressable>
				</M3Section>
				{model.taggedRefs.length > 0 ? (
					<View>
						<ResourceCountSectionHeader title="Images" loadedCount={model.taggedRefs.length} />
						<MaterialListGroup>
							{model.taggedRefs.map((ref, index) => (
								<UpdateRow
									key={`${ref}-${index}`}
									refName={ref}
									info={model.byRef[ref]}
									isChecking={model.checkingRef === ref}
									recheck={() => model.recheck(ref)}
								/>
							))}
						</MaterialListGroup>
					</View>
				) : null}
				{model.errorMessage ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="exclamationmark.triangle" size={20} color={systemColors.red} />
							<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>
								{model.errorMessage}
							</Text>
						</View>
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
