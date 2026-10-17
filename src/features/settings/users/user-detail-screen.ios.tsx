import { Host } from '@/ui/host';
import { Button, Form, HStack, Section, Spacer, Text, Toggle, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	padding,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { FormTextField, FormValueRow } from '@/ui/components/form-fields';
import { DisclosureChevron } from '@/ui/settings-row';

import { FormErrorSection } from '../shared/form-error-section';
import { SettingsSaveBar, SettingsSaveBarSpacer } from '../shared/settings-save-bar';

import { useUserDetail } from './use-user-detail';

export function UserDetailScreen() {
	const model = useUserDetail();
	const { user } = model;

	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: model.title, headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<Form>
					<Section title="Identity">
						<FormValueRow title="Username" value={user?.username ?? ''} />
						<FormTextField
							title="Email"
							placeholder="Optional"
							text={model.email}
							onChangeText={model.setEmail}
							keyboardType="email-address"
							autocapitalization="never"
							autocorrectionDisabled
						/>
						<FormTextField
							title="Display Name"
							placeholder="Optional"
							text={model.displayName}
							onChangeText={model.setDisplayName}
							autocapitalization="words"
						/>
					</Section>
					<Section title="Access">
						{model.supportsV2 ? (
							<Button onPress={model.openRoleAssignments} modifiers={[buttonStyle('plain')]}>
								<HStack modifiers={[contentShape(shapes.rectangle())]}>
									<HStack spacing={12} modifiers={[padding({ vertical: 3 })]}>
										<Image
											systemName="person.crop.rectangle.stack"
											modifiers={[foregroundStyle(systemColors.indigo), frame({ width: 28 })]}
										/>
										<VStack alignment="leading" spacing={3}>
											<Text>Role Assignments</Text>
											<Text
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											>
												Manage global and per-environment roles
											</Text>
										</VStack>
									</HStack>
									<Spacer />
									<DisclosureChevron />
								</HStack>
							</Button>
						) : (
							<Toggle label="Administrator" isOn={model.isAdmin} onIsOnChange={model.setIsAdmin} />
						)}
					</Section>
					<FormErrorSection message={model.errorMessage} />
					<SettingsSaveBarSpacer />
				</Form>
			</Host>
			<SettingsSaveBar
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				onSave={model.save}
				onRevert={model.revertChanges}
			/>
		</View>
	);
}
