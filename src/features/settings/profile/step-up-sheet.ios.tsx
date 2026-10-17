/**
 * Port of `StepUpAuthenticationSheet` (PasskeysMFAView.swift): confirm the
 * user's identity with a password or passkey before a security change.
 * `.sheet(isPresented:)` with `.presentationDetents([.medium])`.
 *
 * SwiftUI-tree: place inside the presenting screen's `Host`.
 */
import {
	BottomSheet,
	Button,
	Form,
	Label,
	NavigationStack,
	ProgressView,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	disabled,
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	presentationDetents
} from '@expo/ui/swift-ui/modifiers';

import { systemColors } from '@/theme/colors';
import { FormSecureField } from '@/ui/components/form-fields';

import type { StepUpSheetProps } from './step-up-sheet.types';
import { useStepUpSheet } from './use-step-up-sheet';

function StepUpContent(props: StepUpSheetProps) {
	const sheet = useStepUpSheet(props);
	return (
		<NavigationStack modifiers={[presentationDetents(['medium'])]}>
			<Toolbar>
				<Form
					modifiers={[navigationTitle('Confirm Identity'), navigationBarTitleDisplayMode('inline')]}
				>
					<Section>
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							Confirm your identity before changing account security settings.
						</Text>
					</Section>
					{props.allowsPassword ? (
						<Section title="Password">
							<FormSecureField
								title="Password"
								placeholder="Current password"
								text={sheet.password}
								onChangeText={sheet.setPassword}
								textContentType="password"
							/>
							<Button
								label="Continue with Password"
								onPress={sheet.submitPassword}
								modifiers={[disabled(sheet.passwordDisabled)]}
							/>
						</Section>
					) : null}
					{props.allowsPasskey ? (
						<Section>
							<Button onPress={sheet.submitPasskey} modifiers={[disabled(sheet.isLoading)]}>
								<Label title="Continue with Passkey" systemImage="person.badge.key.fill" />
							</Button>
						</Section>
					) : null}
					{sheet.errorMessage ? (
						<Section>
							<Label
								title={sheet.errorMessage}
								systemImage="exclamationmark.triangle"
								modifiers={[foregroundStyle(systemColors.red)]}
							/>
						</Section>
					) : null}
				</Form>
				<Toolbar.Content>
					<ToolbarItem placement="cancellationAction">
						<Button label="Cancel" onPress={props.cancel} />
					</ToolbarItem>
					{sheet.isLoading ? (
						<ToolbarItem placement="confirmationAction">
							<ProgressView />
						</ToolbarItem>
					) : null}
				</Toolbar.Content>
			</Toolbar>
		</NavigationStack>
	);
}

export function StepUpSheet(props: StepUpSheetProps) {
	return (
		<BottomSheet
			isPresented={props.isPresented}
			onIsPresentedChange={(presented) => {
				if (!presented) props.onDismissed();
			}}
		>
			<StepUpContent {...props} />
		</BottomSheet>
	);
}
