import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import {
	CenteredMessage,
	M3Section,
	M3TextField,
	SwitchRow,
	TextButtonRow,
	ValueRow
} from '@/features/containers/android-material';
import { withCleanup } from '@/core/with-cleanup';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { useImagePatch, useImagePatchTargets } from './use-image-patch';

export function ImagePatchTargetsScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useImagePatchTargets(envID);
	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(
			() => model.refresh(),
			() => setRefreshing(false)
		);
	};
	const empty = model.targets.length === 0 && !model.loading && model.error === undefined;
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Patch Images',
					headerSearchBarOptions: {
						onChangeText: (event) => model.setSearch(event.nativeEvent.text),
						onClose: () => model.setSearch('')
					}
				}}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingTop: 12, paddingBottom: 24, gap: 12 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{model.error !== undefined ? (
					<Text
						style={[m3Type.bodyMedium, { color: colors.secondaryLabel, paddingHorizontal: 32 }]}
					>
						{model.error}
					</Text>
				) : null}
				{model.targets.length > 0 || model.hasMore ? (
					<MaterialListGroup>
						{model.targets.map((target) => (
							<Pressable
								key={target.imageId}
								onPress={() => model.openPatch(target)}
								accessibilityRole="button"
								android_ripple={{ color: colors.separator as string }}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 12,
									paddingHorizontal: 16,
									paddingVertical: 12
								}}
							>
								<View style={{ flex: 1, gap: 2 }}>
									<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{target.imageRef}</Text>
									<Text
										style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
									>{`${target.fixableCount} fixable · ${target.totalCount} total`}</Text>
									{target.localOnly === true ? (
										<Text style={[m3Type.bodySmall, { color: colors.label }]}>
											Local image cannot be patched
										</Text>
									) : null}
									{target.lastPatch ? (
										<Text
											style={[m3Type.bodySmall, { color: colors.label }]}
										>{`Last patch: ${target.lastPatch.status}`}</Text>
									) : null}
								</View>
								<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
							</Pressable>
						))}
						<PaginatedListFooter
							hasMore={model.hasMore}
							loadMoreError={model.loadMoreError}
							onRetry={model.loadMore}
							onLoadMore={model.loadMore}
						/>
					</MaterialListGroup>
				) : null}
				{model.loading ? (
					<View style={{ alignItems: 'center', padding: 16 }}>
						<ArcaneLoadingView />
					</View>
				) : null}
				{empty ? <CenteredMessage icon="shield" title="No patch targets" message="" /> : null}
			</ScrollView>
		</>
	);
}

export function ImagePatchScreen() {
	const {
		id = '',
		envID = '0',
		name = '',
		localOnly
	} = useLocalSearchParams<{ id?: string; envID?: string; name?: string; localOnly?: string }>();
	const model = useImagePatch({
		environmentID: envID,
		imageID: id,
		imageName: name,
		localOnly: localOnly === '1'
	});
	const { record, fields, set } = model;
	return (
		<>
			<Stack.Screen options={{ title: 'Patch Image' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Source image">
					<Text
						selectable
						style={[
							m3Type.bodyLarge,
							{ color: colors.label, paddingHorizontal: 16, paddingVertical: 14 }
						]}
					>
						{model.imageName}
					</Text>
				</M3Section>
				{model.availabilityError !== undefined ? (
					<Text
						style={[
							m3Type.bodyMedium,
							{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 12 }
						]}
					>
						{model.availabilityError}
					</Text>
				) : null}
				{model.localOnly ? (
					<Text
						style={[
							m3Type.bodyMedium,
							{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 12 }
						]}
					>
						Images without a registry source cannot be patched.
					</Text>
				) : null}
				{record ? (
					<M3Section
						title="Patch result"
						footer="Deploy the patched image separately after reviewing the result."
					>
						<ValueRow title="Status" value={record.status} />
						<ValueRow title="Patched image" value={record.patchedRef} />
						{record.error !== undefined ? (
							<Text
								style={[
									m3Type.bodyMedium,
									{ color: m3.error, paddingHorizontal: 16, paddingVertical: 10 }
								]}
							>
								{record.error}
							</Text>
						) : null}
						{record.packagesUpdated !== undefined ? (
							<ValueRow title="Packages updated" value={String(record.packagesUpdated)} />
						) : null}
						{model.activity ? (
							<Pressable
								onPress={model.openActivity}
								accessibilityRole="button"
								android_ripple={{ color: colors.separator as string }}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									minHeight: 48,
									paddingHorizontal: 16
								}}
							>
								<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>
									Progress and output
								</Text>
								<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
							</Pressable>
						) : null}
						{record.status === 'patching' ? (
							<View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
								<ArcaneLoadingView label="Patching packages" variant="inline" />
							</View>
						) : null}
						<TextButtonRow title="Refresh status" onPress={model.refreshStatus} />
					</M3Section>
				) : (
					<M3Section title="Patched image">
						<M3TextField
							label="Tag suffix (server default when empty)"
							value={fields.suffix}
							onChangeText={set.setSuffix}
						/>
						<M3TextField
							label="Explicit patched tag"
							value={fields.patchedTag}
							onChangeText={set.setPatchedTag}
						/>
						<M3TextField
							label="Scan ID (empty updates all packages)"
							value={fields.scanID}
							onChangeText={set.setScanID}
						/>
						<M3TextField
							label="Timeout in seconds (server default)"
							value={fields.timeout}
							onChangeText={set.setTimeout}
							keyboardType="number-pad"
						/>
						<SwitchRow
							title="Continue after package errors"
							value={fields.ignoreErrors}
							onValueChange={set.setIgnoreErrors}
						/>
						<TextButtonRow
							title="Patch image"
							onPress={model.patch}
							disabled={!model.canPatch || model.submitting}
						/>
						{model.submitting ? (
							<View style={{ padding: 12, alignItems: 'center' }}>
								<ActivityIndicator color={m3.primary as string} />
							</View>
						) : null}
					</M3Section>
				)}
			</ScrollView>
		</>
	);
}
