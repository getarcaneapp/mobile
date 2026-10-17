/** Ports of `ImagePatchTargetsView` and `ImagePatchView` (ImagePatchViews.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	Form,
	HStack,
	LabeledContent,
	List,
	ProgressView,
	Section,
	Spacer,
	Text,
	Toggle,
	VStack
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	buttonStyle,
	contentShape,
	disabled,
	font,
	foregroundStyle,
	keyboardType,
	listStyle,
	refreshable,
	shapes,
	textInputAutocapitalization,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { BoundTextField } from '@/features/containers/swiftui-text-field';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { DisclosureChevron } from '@/ui/settings-row';

import { useImagePatch, useImagePatchTargets } from './use-image-patch';

export function ImagePatchTargetsScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useImagePatchTargets(envID);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Patch Images',
					headerLargeTitleEnabled: false,
					headerSearchBarOptions: {
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearch(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearch('')
					}
				}}
			/>
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
					{model.error !== undefined ? (
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							{model.error}
						</Text>
					) : null}
					{model.targets.map((target) => (
						<Button
							key={target.imageId}
							onPress={() => model.openPatch(target)}
							modifiers={[buttonStyle('plain')]}
						>
							<HStack modifiers={[contentShape(shapes.rectangle())]}>
								<VStack alignment="leading">
									<Text>{target.imageRef}</Text>
									<Text
										modifiers={[
											font({ textStyle: 'caption' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										{`${target.fixableCount} fixable · ${target.totalCount} total`}
									</Text>
									{target.localOnly === true ? (
										<Text modifiers={[font({ textStyle: 'caption' })]}>
											Local image cannot be patched
										</Text>
									) : null}
									{target.lastPatch ? (
										<Text
											modifiers={[font({ textStyle: 'caption' })]}
										>{`Last patch: ${target.lastPatch.status}`}</Text>
									) : null}
								</VStack>
								<Spacer />
								<DisclosureChevron />
							</HStack>
						</Button>
					))}
					{model.loading ? <ArcaneLoadingViewSwiftUI fillsWidth /> : null}
					<PaginatedListFooter
						hasMore={model.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={model.loadMore}
						onLoadMore={model.loadMore}
					/>
					{model.targets.length === 0 && !model.loading && model.error === undefined ? (
						<ContentUnavailableView title="No patch targets" systemImage="shield" />
					) : null}
				</List>
			</Host>
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
			<Stack.Screen options={{ title: 'Patch Image', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<Form modifiers={[textInputAutocapitalization('never'), autocorrectionDisabled()]}>
					<Section title="Source image">
						<Text modifiers={[textSelection(true)]}>{model.imageName}</Text>
					</Section>
					{model.availabilityError !== undefined ? (
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							{model.availabilityError}
						</Text>
					) : null}
					{model.localOnly ? (
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							Images without a registry source cannot be patched.
						</Text>
					) : null}
					{record ? (
						<Section title="Patch result">
							<LabeledContent label="Status">
								<Text>{record.status}</Text>
							</LabeledContent>
							<LabeledContent label="Patched image">
								<Text>{record.patchedRef}</Text>
							</LabeledContent>
							{record.error !== undefined ? (
								<Text modifiers={[foregroundStyle(systemColors.red)]}>{record.error}</Text>
							) : null}
							{record.packagesUpdated !== undefined ? (
								<LabeledContent label="Packages updated">
									<Text>{String(record.packagesUpdated)}</Text>
								</LabeledContent>
							) : null}
							{model.activity ? (
								<Button onPress={model.openActivity} modifiers={[buttonStyle('plain')]}>
									<HStack modifiers={[contentShape(shapes.rectangle())]}>
										<Text>Progress and output</Text>
										<Spacer />
										<DisclosureChevron />
									</HStack>
								</Button>
							) : null}
							{record.status === 'patching' ? (
								<ArcaneLoadingViewSwiftUI label="Patching packages" variant="inline" />
							) : null}
							<Button label="Refresh status" onPress={model.refreshStatus} />
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								Deploy the patched image separately after reviewing the result.
							</Text>
						</Section>
					) : (
						<Section title="Patched image">
							<BoundTextField
								placeholder="Tag suffix (server default when empty)"
								value={fields.suffix}
								onChangeText={set.setSuffix}
							/>
							<BoundTextField
								placeholder="Explicit patched tag"
								value={fields.patchedTag}
								onChangeText={set.setPatchedTag}
							/>
							<BoundTextField
								placeholder="Scan ID (empty updates all packages)"
								value={fields.scanID}
								onChangeText={set.setScanID}
							/>
							<BoundTextField
								placeholder="Timeout in seconds (server default)"
								value={fields.timeout}
								onChangeText={set.setTimeout}
								modifiers={[keyboardType('numeric')]}
							/>
							<Toggle
								label="Continue after package errors"
								isOn={fields.ignoreErrors}
								onIsOnChange={set.setIgnoreErrors}
							/>
							<Button
								label="Patch image"
								onPress={model.patch}
								modifiers={[disabled(!model.canPatch || model.submitting)]}
							/>
							{model.submitting ? <ProgressView /> : null}
						</Section>
					)}
				</Form>
			</Host>
		</>
	);
}
