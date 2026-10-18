import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { StatusIcon } from '@/ui/components/resource-status-badge';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, SwitchRow } from '@/features/containers/android-material';

import { SheetError } from './android-parts';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { containerDisplayName, containerIsRunning } from '@/features/containers/container-model';

import { networkDrivers, useConnectNetworkContainer, useCreateNetwork } from './use-network-sheets';

export function CreateNetworkScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useCreateNetwork(envID);
	return (
		<>
			<Stack.Screen options={{ title: 'Create Network' }} />
			<AndroidToolbar
				placement="left"
				items={[
					{ kind: 'button', id: 'cancel', icon: 'xmark', label: 'Cancel', onPress: model.cancel }
				]}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'create',
						icon: 'checkmark',
						label: 'Create',
						disabled: !model.canCreate,
						onPress: model.create
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Network Details">
					<FormTextField
						title="Name"
						placeholder="frontend"
						text={model.name}
						onChangeText={model.setName}
						autocapitalization="never"
						autocorrectionDisabled
					/>
					<FormPicker
						title="Driver"
						selection={model.driver}
						onSelectionChange={model.setDriver}
						options={networkDrivers}
					/>
					<SwitchRow
						title="Internal"
						value={model.isInternal}
						onValueChange={model.setIsInternal}
					/>
				</M3Section>
				<M3Section title="IPAM (Optional)" footer={model.footer}>
					<FormTextField
						title="Subnet"
						placeholder="10.0.0.0/24"
						text={model.subnet}
						onChangeText={model.setSubnet}
						autocapitalization="never"
						autocorrectionDisabled
					/>
					<FormTextField
						title="Gateway"
						placeholder="10.0.0.1"
						text={model.gateway}
						onChangeText={model.setGateway}
						autocapitalization="never"
						autocorrectionDisabled
					/>
					<FormTextField
						title="IP Range"
						placeholder="10.0.0.128/25"
						text={model.ipRange}
						onChangeText={model.setIPRange}
						autocapitalization="never"
						autocorrectionDisabled
						helper="Optional sub-range carved from the subnet."
					/>
				</M3Section>
				<SheetError message={model.errorMessage} />
			</ScrollView>
		</>
	);
}

export function ConnectNetworkContainerScreen() {
	const {
		id = '',
		envID = '0',
		name = '',
		token
	} = useLocalSearchParams<{ id?: string; envID?: string; name?: string; token?: string }>();
	const model = useConnectNetworkContainer({ environmentID: envID, networkID: id, token });
	return (
		<>
			<Stack.Screen
				options={{ title: `Connect to ${name}`, gestureEnabled: !model.isSubmitting }}
			/>
			<AndroidToolbar
				placement="left"
				items={[
					{
						kind: 'button',
						id: 'cancel',
						icon: 'xmark',
						label: 'Cancel',
						disabled: model.isSubmitting,
						onPress: model.cancel
					}
				]}
			/>
			<AndroidToolbar
				items={
					model.isSubmitting
						? [{ kind: 'spinner', id: 'connect', label: 'Connect' }]
						: [
								{
									kind: 'button',
									id: 'connect',
									icon: 'checkmark',
									label: 'Connect',
									disabled: !model.canConnect,
									onPress: model.connect
								}
							]
				}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Container">
					{model.isLoading && model.containers.length === 0 ? (
						<View style={{ padding: 16, alignItems: 'center' }}>
							<ArcaneLoadingView />
						</View>
					) : model.candidates.length === 0 ? (
						<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel, padding: 16 }]}>
							No other containers available.
						</Text>
					) : (
						model.candidates.map((container) => {
							const selected = model.selectedID === container.id;
							return (
								<Pressable
									key={container.id}
									onPress={() => model.setSelectedID(container.id)}
									accessibilityRole="radio"
									accessibilityState={{ selected }}
									android_ripple={{ color: colors.separator as string }}
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 16,
										paddingHorizontal: 16,
										paddingVertical: 10
									}}
								>
									<StatusIcon status={container.status} isLive={containerIsRunning(container)} />
									<View style={{ flex: 1, gap: 2 }}>
										<Text style={[m3Type.bodyLarge, { color: colors.label }]}>
											{containerDisplayName(container)}
										</Text>
										<Text
											numberOfLines={1}
											style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
										>
											{container.image}
										</Text>
									</View>
									{selected ? <Icon name="checkmark" size={20} color={m3.primary} /> : null}
								</Pressable>
							);
						})
					)}
				</M3Section>
				<M3Section title="Options">
					<FormTextField
						title="Aliases"
						placeholder="web, api"
						text={model.aliases}
						onChangeText={model.setAliases}
						autocapitalization="never"
						autocorrectionDisabled
						helper="Comma-separated DNS names on this network."
					/>
					<FormTextField
						title="IPv4 Address"
						placeholder="Automatic"
						text={model.ipv4}
						onChangeText={model.setIPv4}
						keyboardType="numbers-and-punctuation"
						autocapitalization="never"
						autocorrectionDisabled
					/>
				</M3Section>
				<SheetError message={model.errorMessage} />
			</ScrollView>
		</>
	);
}
