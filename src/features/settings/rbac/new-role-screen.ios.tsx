/**
 * Port of `RoleDetailView(mode: .create)` presented from RolesView's `+`
 * (RolesView.swift): its own NavigationStack with Cancel, permission search
 * and the floating Create bar.
 */
import { Host } from '@/ui/host';
import { Button, NavigationStack, Toolbar, ToolbarItem, useNativeState } from '@expo/ui/swift-ui';
import {
	navigationBarTitleDisplayMode,
	navigationTitle,
	searchable
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { ToastHost } from '@/ui/toast';

import { SettingsSaveBar } from '../shared/settings-save-bar';

import { RoleDetailForm } from './role-detail-form';
import { useRoleDetail } from './use-role-detail';

export function NewRoleScreen() {
	const model = useRoleDetail('create');
	const searchText = useNativeState('');
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<RoleDetailForm
							model={model}
							modifiers={[
								searchable(searchText, {
									placement: 'navigationBarDrawer',
									prompt: 'Search permissions',
									onChange: model.setSearch
								}),
								navigationTitle(model.title),
								navigationBarTitleDisplayMode('inline')
							]}
						/>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} />
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<SettingsSaveBar
				reservesTabBarSpace={false}
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				canSave={model.canSave}
				saveAccessibilityLabel="Create"
				onSave={model.save}
				onRevert={model.revertChanges}
			/>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
