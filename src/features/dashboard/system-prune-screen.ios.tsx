/**
 * Port of `SystemPruneView` (DashboardView.swift): per-resource prune modes
 * for one environment, or "Prune All Environments". Presented as a sheet route.
 */
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	NavigationStack,
	ProgressView,
	Section,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	disabled,
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	scaleEffect,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import {
	singleActionConfig,
	useDeleteConfirmation,
	DeleteConfirmationHost
} from '@/ui/components/delete-confirmation';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { DestructiveLabel } from '@/ui/components/labels';
import { ToastHost } from '@/ui/toast';

import { pruneOptions, useSystemPrune } from './use-system-prune';
import { systemPruneConfirmationHost, useSystemPruneRoute } from './use-system-prune-route';

function AgeRow({ text, onChangeText }: { text: string; onChangeText: (value: string) => void }) {
	return (
		<FormTextField
			title="Older Than"
			placeholder="24h or 7d"
			text={text}
			onChangeText={onChangeText}
			autocapitalization="never"
			autocorrectionDisabled
		/>
	);
}

export function SystemPruneScreen() {
	const router = useRouter();
	const accent = useAccentColor();
	const route = useSystemPruneRoute();
	const dismiss = () => router.back();
	const model = useSystemPrune({
		environmentID: route.environmentID,
		environments: route.environments,
		onDismiss: dismiss
	});
	const [confirming, setConfirming] = useState(false);
	useDeleteConfirmation(
		confirming,
		setConfirming,
		singleActionConfig({
			title: model.confirmation.title,
			message: model.confirmation.message,
			icon: model.confirmation.icon,
			confirmTitle: model.confirmation.confirmTitle,
			dismissOnConfirm: false,
			onConfirm: () => void model.runPrune()
		}),
		systemPruneConfirmationHost
	);

	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								disabled(model.isPruning),
								navigationTitle(model.title),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<Section title="Containers">
								<FormPicker
									title="Containers"
									selection={model.containerMode}
									onSelectionChange={model.setContainerMode}
									options={pruneOptions.containers}
								/>
								{model.containerMode === 'olderThan' ? (
									<AgeRow text={model.containerAge} onChangeText={model.setContainerAge} />
								) : null}
							</Section>
							<Section title="Images">
								<FormPicker
									title="Images"
									selection={model.imageMode}
									onSelectionChange={model.setImageMode}
									options={pruneOptions.images}
								/>
								{model.imageMode === 'olderThan' ? (
									<AgeRow text={model.imageAge} onChangeText={model.setImageAge} />
								) : null}
							</Section>
							<Section title="Volumes">
								<FormPicker
									title="Volumes"
									selection={model.volumeMode}
									onSelectionChange={model.setVolumeMode}
									options={pruneOptions.volumes}
								/>
							</Section>
							<Section title="Networks">
								<FormPicker
									title="Networks"
									selection={model.networkMode}
									onSelectionChange={model.setNetworkMode}
									options={pruneOptions.networks}
								/>
								{model.networkMode === 'olderThan' ? (
									<AgeRow text={model.networkAge} onChangeText={model.setNetworkAge} />
								) : null}
							</Section>
							<Section title="Build Cache">
								<FormPicker
									title="Build Cache"
									selection={model.buildCacheMode}
									onSelectionChange={model.setBuildCacheMode}
									options={pruneOptions.buildCache}
								/>
								{model.buildCacheMode === 'olderThan' ? (
									<AgeRow text={model.buildCacheAge} onChangeText={model.setBuildCacheAge} />
								) : null}
							</Section>
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Cancel"
									onPress={dismiss}
									modifiers={[foregroundStyle(accent), disabled(model.isPruning)]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								{model.isPruning ? (
									<ProgressView modifiers={[scaleEffect(0.8)]} />
								) : (
									<Button
										onPress={() => setConfirming(true)}
										modifiers={[tint(systemColors.red), disabled(model.confirmDisabled)]}
									>
										<DestructiveLabel text={model.confirmButtonTitle} />
									</Button>
								)}
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<DeleteConfirmationHost hostID={systemPruneConfirmationHost} />
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
