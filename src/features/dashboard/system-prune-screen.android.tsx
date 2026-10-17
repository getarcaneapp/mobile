import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import {
	DeleteConfirmationHost,
	singleActionConfig,
	useDeleteConfirmation
} from '@/ui/components/delete-confirmation';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';
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

	const section = (title: string, children: React.ReactNode) => (
		<View>
			<MaterialSectionHeader title={title} />
			<MaterialListGroup>{children}</MaterialListGroup>
		</View>
	);

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: model.title, headerShown: true }} />
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.View>
					{model.isPruning ? (
						<ActivityIndicator color={m3.primary} />
					) : (
						<Pressable
							onPress={() => setConfirming(true)}
							disabled={model.confirmDisabled}
							accessibilityRole="button"
							style={{
								paddingHorizontal: 12,
								paddingVertical: 8,
								opacity: model.confirmDisabled ? 0.38 : 1
							}}
						>
							<Text style={[m3Type.labelLarge, { color: systemColors.red }]}>
								{model.confirmButtonTitle}
							</Text>
						</Pressable>
					)}
				</Stack.Toolbar.View>
			</Stack.Toolbar>
			<ScrollView
				pointerEvents={model.isPruning ? 'none' : 'auto'}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				{section(
					'Containers',
					<>
						<FormPicker
							title="Containers"
							selection={model.containerMode}
							onSelectionChange={model.setContainerMode}
							options={pruneOptions.containers}
						/>
						{model.containerMode === 'olderThan' ? (
							<AgeRow text={model.containerAge} onChangeText={model.setContainerAge} />
						) : null}
					</>
				)}
				{section(
					'Images',
					<>
						<FormPicker
							title="Images"
							selection={model.imageMode}
							onSelectionChange={model.setImageMode}
							options={pruneOptions.images}
						/>
						{model.imageMode === 'olderThan' ? (
							<AgeRow text={model.imageAge} onChangeText={model.setImageAge} />
						) : null}
					</>
				)}
				{section(
					'Volumes',
					<FormPicker
						title="Volumes"
						selection={model.volumeMode}
						onSelectionChange={model.setVolumeMode}
						options={pruneOptions.volumes}
					/>
				)}
				{section(
					'Networks',
					<>
						<FormPicker
							title="Networks"
							selection={model.networkMode}
							onSelectionChange={model.setNetworkMode}
							options={pruneOptions.networks}
						/>
						{model.networkMode === 'olderThan' ? (
							<AgeRow text={model.networkAge} onChangeText={model.setNetworkAge} />
						) : null}
					</>
				)}
				{section(
					'Build Cache',
					<>
						<FormPicker
							title="Build Cache"
							selection={model.buildCacheMode}
							onSelectionChange={model.setBuildCacheMode}
							options={pruneOptions.buildCache}
						/>
						{model.buildCacheMode === 'olderThan' ? (
							<AgeRow text={model.buildCacheAge} onChangeText={model.setBuildCacheAge} />
						) : null}
					</>
				)}
			</ScrollView>
			<DeleteConfirmationHost hostID={systemPruneConfirmationHost} />
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
