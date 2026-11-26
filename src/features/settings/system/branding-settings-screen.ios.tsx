import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	ProgressView,
	Section,
	Spacer,
	Text,
	Toggle,
	VStack
} from '@expo/ui/swift-ui';
import {
	disabled,
	font,
	foregroundStyle,
	refreshable,
	scaleEffect
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { CachedAsyncImageSwiftUI } from '@/ui/components/cached-async-image-swiftui';
import { Image } from '@/ui/components/swiftui-image';

import { brandSlotFooter } from './branding-model';
import { useBrandingSettings, type BrandSlotState } from './use-branding-settings';

type BrandingModel = ReturnType<typeof useBrandingSettings>;

function BrandSlotSection({ slot, model }: { slot: BrandSlotState; model: BrandingModel }) {
	const isUploading = model.pending?.slot === slot.slot && model.pending.action === 'upload';
	const isRemoving = model.pending?.slot === slot.slot && model.pending.action === 'remove';
	const isBusy = model.pending !== undefined || model.isReadOnly;
	return (
		<Section footer={<Text>{brandSlotFooter(slot)}</Text>}>
			<HStack spacing={14}>
				<CachedAsyncImageSwiftUI
					url={slot.previewURL}
					size={56}
					fallback={
						<Image
							systemName={slot.systemImage as never}
							modifiers={[
								font({ size: 26 }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						/>
					}
				/>
				<VStack alignment="leading" spacing={2}>
					<Text>{slot.title}</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{slot.isCustom ? 'Custom' : 'Default'}
					</Text>
				</VStack>
				<Spacer />
			</HStack>
			<Button onPress={() => model.upload(slot)} modifiers={[disabled(isBusy)]}>
				<HStack>
					<Label title={slot.isCustom ? 'Replace' : 'Upload'} systemImage="square.and.arrow.up" />
					<Spacer />
					{isUploading ? <ProgressView modifiers={[scaleEffect(0.8)]} /> : null}
				</HStack>
			</Button>
			{slot.isCustom ? (
				<Button
					role="destructive"
					onPress={() => model.remove(slot)}
					modifiers={[disabled(isBusy)]}
				>
					<HStack>
						<Label title="Remove" systemImage="trash" />
						<Spacer />
						{isRemoving ? <ProgressView modifiers={[scaleEffect(0.8)]} /> : null}
					</HStack>
				</Button>
			) : null}
		</Section>
	);
}

export function BrandingDestination() {
	const model = useBrandingSettings();
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: 'Branding', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<Form modifiers={[refreshable(model.load)]}>
					{model.errorMessage !== undefined ? (
						<Section>
							<Label
								title={model.errorMessage}
								systemImage="exclamationmark.triangle"
								modifiers={[foregroundStyle(systemColors.red)]}
							/>
						</Section>
					) : null}
					{model.hasLoaded
						? model.slots.map((slot) => (
								<BrandSlotSection key={slot.slot} slot={slot} model={model} />
							))
						: null}
					{model.hasLoaded && model.showsDevelopmentBranding ? (
						<Section
							footer={
								<Text>Shows the development icon instead of the Arcane logo on this build.</Text>
							}
						>
							<Toggle
								label="Development Branding"
								isOn={model.developmentBranding}
								onIsOnChange={model.setDevelopmentBranding}
								modifiers={[
									disabled(
										model.isReadOnly || model.developmentBrandingLocked || model.isSavingDevelopment
									)
								]}
							/>
						</Section>
					) : null}
				</Form>
			</Host>
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
