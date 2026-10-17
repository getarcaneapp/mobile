/** Ports of `CreateNetworkView` and `ConnectNetworkContainerSheet` (NetworksView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	NavigationStack,
	Section,
	Spacer,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	navigationBarTitleDisplayMode,
	navigationTitle
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { useAccentColor } from '@/theme/accent';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { StatusIcon } from '@/ui/components/resource-status-badge';

import { containerDisplayName, containerIsRunning } from '@/features/containers/container-model';

import { networkDrivers, useConnectNetworkContainer, useCreateNetwork } from './use-network-sheets';

export function CreateNetworkScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useCreateNetwork(envID);
	const toolbarSymbol = useAppAccentToolbarSymbol();
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form
						modifiers={[navigationTitle('Create Network'), navigationBarTitleDisplayMode('inline')]}
					>
						<Section title="Network Details">
							<FormTextField
								title="Name"
								placeholder="frontend"
								text={model.name}
								onChangeText={model.setName}
								autocapitalization="never"
								autocorrectionDisabled
								helper="Use a short Docker network name with no spaces."
							/>
							<FormPicker
								title="Driver"
								selection={model.driver}
								onSelectionChange={model.setDriver}
								options={networkDrivers}
								helper="Bridge is the standard single-host Docker network driver."
							/>
							<Toggle label="Internal" isOn={model.isInternal} onIsOnChange={model.setIsInternal} />
						</Section>
						<Section title="IPAM (Optional)">
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
						</Section>
						<Section footer={<Text>{model.footer}</Text>}>{null}</Section>
						{model.errorMessage ? (
							<Section>
								<Label
									title={model.errorMessage}
									systemImage="exclamationmark.triangle"
									modifiers={[foregroundStyle(systemColors.red)]}
								/>
							</Section>
						) : null}
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							<Button
								label="Create"
								onPress={model.create}
								modifiers={[disabled(!model.canCreate), ...toolbarSymbol]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
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
	const accent = useAccentColor();
	const toolbarSymbol = useAppAccentToolbarSymbol();
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !model.isSubmitting }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle(`Connect to ${name}`),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<Section title="Container">
								{model.isLoading && model.containers.length === 0 ? (
									<VStack modifiers={[frame({ maxWidth: Infinity })]}>
										<ArcaneLoadingViewSwiftUI />
									</VStack>
								) : model.candidates.length === 0 ? (
									<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
										No other containers available.
									</Text>
								) : (
									model.candidates.map((container) => (
										<Button
											key={container.id}
											onPress={() => model.setSelectedID(container.id)}
											modifiers={[buttonStyle('automatic')]}
										>
											<HStack spacing={12}>
												<StatusIcon
													status={container.status}
													isLive={containerIsRunning(container)}
												/>
												<VStack alignment="leading" spacing={2}>
													<Text modifiers={[foregroundStyle('primary')]}>
														{containerDisplayName(container)}
													</Text>
													<Text
														modifiers={[
															font({ textStyle: 'caption' }),
															foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
															lineLimit(1)
														]}
													>
														{container.image}
													</Text>
												</VStack>
												<Spacer minLength={0} />
												{model.selectedID === container.id ? (
													<Image systemName="checkmark" modifiers={[foregroundStyle(accent)]} />
												) : null}
											</HStack>
										</Button>
									))
								)}
							</Section>
							<Section header={<Text>Options</Text>}>
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
							</Section>
							{model.errorMessage ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[foregroundStyle(systemColors.red), font({ textStyle: 'callout' })]}
									/>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="topBarLeading">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.isSubmitting), ...toolbarSymbol]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="topBarTrailing">
								<Button
									label="Connect"
									onPress={model.connect}
									modifiers={[disabled(!model.canConnect), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
		</>
	);
}
