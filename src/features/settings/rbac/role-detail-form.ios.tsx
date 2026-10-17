/**
 * The Form body of `RoleDetailView` (RolesView.swift): Role Info, the
 * permission picker (spinner until the manifest arrives), the mode footer and
 * the inline error. Shared by the pushed detail and the New Role sheet.
 *
 * SwiftUI-tree.
 */
import { Form, HStack, ProgressView, Section, Spacer, Text } from '@expo/ui/swift-ui';
import { scaleEffect, type ModifierConfig } from '@expo/ui/swift-ui/modifiers';

import { FormTextField, FormValueRow } from '@/ui/components/form-fields';

import { FormErrorSection } from '../shared/form-error-section';
import { SettingsSaveBarSpacer } from '../shared/settings-save-bar';

import { PermissionPicker } from './permission-picker';
import type { RoleDetailModel } from './use-role-detail';

export function RoleDetailForm({
	model,
	modifiers
}: {
	model: RoleDetailModel;
	modifiers?: ModifierConfig[];
}) {
	const { isReadOnly } = model;
	return (
		<Form modifiers={modifiers}>
			<Section
				header={<Text>Role Info</Text>}
				footer={
					isReadOnly ? undefined : <Text>Use a short name that explains who this role is for.</Text>
				}
			>
				{isReadOnly ? (
					<>
						<FormValueRow title="Name" value={model.name} />
						{model.description !== '' ? (
							<FormValueRow title="Description" value={model.description} />
						) : null}
					</>
				) : (
					<>
						<FormTextField
							title="Name"
							placeholder="Deploy Operator"
							text={model.name}
							onChangeText={model.setName}
						/>
						<FormTextField
							title="Description"
							placeholder="Optional"
							text={model.description}
							onChangeText={model.setDescription}
							axis="vertical"
							lineLimit={{ min: 2, max: 4 }}
						/>
					</>
				)}
			</Section>
			{model.manifest ? (
				<PermissionPicker
					manifest={model.manifest}
					selected={model.selectedPermissions}
					onSetPermissions={model.setPermissions}
					isReadOnly={isReadOnly}
					search={model.search}
				/>
			) : (
				<Section>
					<HStack>
						<Spacer />
						<ProgressView modifiers={[scaleEffect(0.8)]} />
						<Spacer />
					</HStack>
				</Section>
			)}
			<Section
				footer={
					<Text>
						{isReadOnly
							? 'Built-in roles cannot be edited.'
							: 'Select which actions this role can perform.'}
					</Text>
				}
			>
				{null}
			</Section>
			<FormErrorSection message={model.errorMessage} />
			<SettingsSaveBarSpacer isPresented={!isReadOnly} />
		</Form>
	);
}
