import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import { IconSwitchRow } from '@/features/settings/app/android-rows';
import { M3Section } from '@/features/settings/shared/android-material';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { CachedAsyncImage } from '@/ui/components/cached-async-image';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListItem } from '@/ui/material/list';

import { brandSlotFooter } from './branding-model';
import { useBrandingSettings, type BrandSlotState } from './use-branding-settings';

type BrandingModel = ReturnType<typeof useBrandingSettings>;

function BrandSlotSection({ slot, model }: { slot: BrandSlotState; model: BrandingModel }) {
	const isUploading = model.pending?.slot === slot.slot && model.pending.action === 'upload';
	const isRemoving = model.pending?.slot === slot.slot && model.pending.action === 'remove';
	const isBusy = model.pending !== undefined || model.isReadOnly;
	return (
		<M3Section footer={brandSlotFooter(slot)}>
			<MaterialListItem
				headline={slot.title}
				supporting={slot.isCustom ? 'Custom' : 'Default'}
				leading={
					<CachedAsyncImage
						url={slot.previewURL}
						size={48}
						fallback={<Icon name={slot.systemImage} size={28} color={colors.secondaryLabel} />}
					/>
				}
			/>
			<MaterialListItem
				headline={slot.isCustom ? 'Replace' : 'Upload'}
				icon="square.and.arrow.up"
				iconColor={m3.primary}
				trailing={isUploading ? <ActivityIndicator color={m3.primary as string} /> : undefined}
				onPress={isBusy ? undefined : () => model.upload(slot)}
			/>
			{slot.isCustom ? (
				<MaterialListItem
					headline="Remove"
					icon="trash"
					iconColor={m3.error}
					destructive
					trailing={isRemoving ? <ActivityIndicator color={m3.error as string} /> : undefined}
					onPress={isBusy ? undefined : () => model.remove(slot)}
				/>
			) : null}
		</M3Section>
	);
}

export function BrandingDestination() {
	const model = useBrandingSettings();
	const [refreshing, setRefreshing] = useState(false);
	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: 'Branding' }} />
			<ScrollView
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.load().finally(() => setRefreshing(false));
						}}
						colors={[m3.primary as string]}
					/>
				}
			>
				{model.errorMessage !== undefined ? (
					<M3Section>
						<View
							accessibilityRole="alert"
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 16,
								minHeight: 56,
								paddingHorizontal: 16,
								paddingVertical: 12
							}}
						>
							<Icon name="exclamationmark.triangle" size={22} color={m3.error} />
							<Text style={[m3Type.bodyLarge, { flex: 1, color: m3.error }]}>
								{model.errorMessage}
							</Text>
						</View>
					</M3Section>
				) : null}
				{model.hasLoaded
					? model.slots.map((slot) => (
							<BrandSlotSection key={slot.slot} slot={slot} model={model} />
						))
					: null}
				{model.hasLoaded && model.showsDevelopmentBranding ? (
					<M3Section footer="Shows the development icon instead of the Arcane logo on this build.">
						<IconSwitchRow
							title="Development Branding"
							icon="hammer.fill"
							iconColor={systemColors.orange}
							value={model.developmentBranding}
							onValueChange={model.setDevelopmentBranding}
							disabled={
								model.isReadOnly || model.developmentBrandingLocked || model.isSavingDevelopment
							}
						/>
					</M3Section>
				) : null}
			</ScrollView>
			{model.isLoading && !model.hasLoaded ? (
				<View
					pointerEvents="none"
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						alignItems: 'center',
						justifyContent: 'center'
					}}
				>
					<ArcaneLoadingView label="Loading…" />
				</View>
			) : null}
		</View>
	);
}
