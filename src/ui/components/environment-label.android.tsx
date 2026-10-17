/**
 * Android ports of `EnvironmentLabel`, `EnvironmentFilterSection` (Material 3
 * radio list), `EnvironmentLoadFailuresSection` and `EnvironmentActionButton`
 * (a list item that opens a Material dropdown of environments when there are
 * several). For toolbar menus use `EnvironmentToolbarAction` from `toolbar`.
 *
 * Standalone (RN views).
 */
import { Host } from '@expo/ui';
import {
	DropdownMenu,
	DropdownMenuItem,
	RadioButton,
	Text as ComposeText
} from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialListItem, MaterialSectionHeader } from '@/ui/material/list';

import {
	environmentActionIsMenu,
	environmentTitle,
	showsEnvironmentFilter,
	type EnvironmentActionButtonProps,
	type EnvironmentFilterSectionProps,
	type EnvironmentLabelProps,
	type EnvironmentLoadFailuresSectionProps
} from './environment-label.types';
import { m3 } from './material-colors';
import { m3Type } from './type-scale';

export function EnvironmentLabel({ name, color }: EnvironmentLabelProps) {
	if (!name) return null;
	const tint = color ?? colors.secondaryLabel;
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
			<Icon name="server.rack" size={12} color={tint} />
			<Text style={[m3Type.bodySmall, { color: tint }]}>{name}</Text>
		</View>
	);
}

function RadioRow({
	title,
	selected,
	onPress
}: {
	title: string;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="radio"
			accessibilityState={{ selected }}
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				minHeight: 56,
				paddingHorizontal: 16,
				gap: 16
			}}
		>
			<Host matchContents>
				<RadioButton selected={selected} onClick={onPress} />
			</Host>
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
		</Pressable>
	);
}

export function EnvironmentFilterSection({
	environments,
	selection,
	onSelectionChange
}: EnvironmentFilterSectionProps) {
	if (!showsEnvironmentFilter(environments)) return null;
	return (
		<View>
			<MaterialSectionHeader title="Environment" />
			<MaterialListGroup>
				<RadioRow
					title="All Environments"
					selected={selection === undefined}
					onPress={() => onSelectionChange(undefined)}
				/>
				{environments.map((environment) => (
					<RadioRow
						key={environment.id}
						title={environmentTitle(environment)}
						selected={selection === environment.id}
						onPress={() => onSelectionChange(environment.id)}
					/>
				))}
			</MaterialListGroup>
		</View>
	);
}

export function EnvironmentLoadFailuresSection({
	failures,
	retry
}: EnvironmentLoadFailuresSectionProps) {
	if (failures.length === 0) return null;
	return (
		<MaterialListGroup>
			{failures.map((failure) => (
				<MaterialListItem
					key={failure.id}
					icon="exclamationmark.triangle"
					headline={`Couldn't load ${environmentTitle(failure.environment)}`}
					supporting={failure.message}
				/>
			))}
			<MaterialListItem
				headline="Retry"
				icon="arrow.clockwise"
				iconColor={m3.primary}
				onPress={retry}
			/>
		</MaterialListGroup>
	);
}

export function EnvironmentActionButton({
	title,
	systemImage,
	environments,
	action
}: EnvironmentActionButtonProps) {
	const [expanded, setExpanded] = useState(false);
	const first = environments[0];
	if (!environmentActionIsMenu(environments)) {
		if (!first) return null;
		return (
			<MaterialListItem headline={title} icon={systemImage} onPress={() => action(first.id)} />
		);
	}
	return (
		<View>
			<MaterialListItem
				headline={title}
				icon={systemImage}
				trailing={<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />}
				onPress={() => setExpanded(true)}
			/>
			<Host matchContents style={{ position: 'absolute', right: 16, bottom: 0 }}>
				<DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
					<DropdownMenu.Items>
						{environments.map((environment) => (
							<DropdownMenuItem
								key={environment.id}
								onClick={() => {
									setExpanded(false);
									action(environment.id);
								}}
							>
								<DropdownMenuItem.Text>
									<ComposeText>{environmentTitle(environment)}</ComposeText>
								</DropdownMenuItem.Text>
							</DropdownMenuItem>
						))}
					</DropdownMenu.Items>
				</DropdownMenu>
			</Host>
		</View>
	);
}
