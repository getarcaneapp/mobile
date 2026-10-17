import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, TextButtonRow } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { capitalized } from '@/features/containers/container-model';

import {
	projectTagColors,
	projectTagDisplayColor,
	projectTagIsComposeManaged
} from './project-model';
import { useProjectTags } from './use-project-tags';

export function ProjectTagsScreen() {
	const model = useProjectTags();
	return (
		<>
			<Stack.Screen options={{ title: 'Tags' }} />
			<AndroidToolbar
				items={[
					{ kind: 'button', id: 'done', icon: 'checkmark', label: 'Done', onPress: model.done }
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				{model.rows.length > 0 ? (
					<M3Section
						title="Tags"
						footer={model.hasComposeManaged ? 'Locked tags come from the compose file.' : undefined}
					>
						{model.rows.map((tag) => {
							const managed = projectTagIsComposeManaged(tag);
							const disabled = managed || model.pendingName !== undefined;
							return (
								<Pressable
									key={tag.name}
									onPress={() => model.toggle(tag)}
									disabled={disabled}
									accessibilityRole="checkbox"
									accessibilityState={{ checked: model.isAttached(tag), disabled }}
									android_ripple={{ color: colors.separator as string }}
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 16,
										minHeight: 56,
										paddingHorizontal: 16
									}}
								>
									<Icon name="tag.fill" size={20} color={projectTagDisplayColor(tag.color)} />
									<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>
										{tag.name}
									</Text>
									{model.pendingName === tag.name ? (
										<ActivityIndicator size="small" />
									) : managed ? (
										<Icon name="lock.fill" size={18} color={colors.secondaryLabel} />
									) : model.isAttached(tag) ? (
										<Icon name="checkmark" size={20} color={m3.primary} />
									) : null}
								</Pressable>
							);
						})}
					</M3Section>
				) : null}
				<M3Section title="New Tag">
					<FormTextField
						title="Name"
						placeholder="production"
						text={model.newName}
						onChangeText={model.setNewName}
						autocapitalization="never"
						autocorrectionDisabled
					/>
					<View
						style={{
							flexDirection: 'row',
							gap: 10,
							paddingHorizontal: 16,
							paddingVertical: 8,
							flexWrap: 'wrap'
						}}
					>
						{projectTagColors.map((color) => {
							const selected = model.newColor === color;
							return (
								<Pressable
									key={color}
									onPress={() => model.setNewColor(color)}
									accessibilityRole="radio"
									accessibilityLabel={capitalized(color)}
									accessibilityState={{ selected }}
									style={{
										width: 28,
										height: 28,
										borderRadius: 14,
										backgroundColor: projectTagDisplayColor(color),
										alignItems: 'center',
										justifyContent: 'center'
									}}
								>
									{selected ? <Icon name="checkmark" size={14} color="#FFFFFF" /> : null}
								</Pressable>
							);
						})}
					</View>
					<TextButtonRow
						title="Add Tag"
						onPress={model.addTag}
						disabled={model.trimmedNewName === '' || model.pendingName !== undefined}
					/>
				</M3Section>
				{model.errorMessage !== undefined ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
						<Icon name="exclamationmark.triangle.fill" size={18} color={systemColors.red} />
						<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>
							{model.errorMessage}
						</Text>
					</View>
				) : null}
			</ScrollView>
		</>
	);
}
