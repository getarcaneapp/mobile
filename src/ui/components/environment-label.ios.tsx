import { Button, HStack, Label, Menu, Picker, Section, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	font,
	foregroundStyle,
	labelsHidden,
	pickerStyle,
	tag
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import {
	environmentActionIsMenu,
	environmentTitle,
	showsEnvironmentFilter,
	type EnvironmentActionButtonProps,
	type EnvironmentFilterSectionProps,
	type EnvironmentLabelProps,
	type EnvironmentLoadFailuresSectionProps
} from './environment-label.types';

const allEnvironmentsTag = '__all_environments__';

export function EnvironmentLabel({ name, color }: EnvironmentLabelProps) {
	if (!name) return null;
	return (
		<HStack
			spacing={4}
			modifiers={[font({ textStyle: 'caption' }), foregroundStyle(color ?? 'secondary')]}
		>
			<Image systemName="server.rack" modifiers={[accessibilityHidden(true)]} />
			<Text>{name}</Text>
		</HStack>
	);
}

export function EnvironmentFilterSection({
	environments,
	selection,
	onSelectionChange
}: EnvironmentFilterSectionProps) {
	if (!showsEnvironmentFilter(environments)) return null;
	return (
		<Section title="Environment">
			<Picker
				label="Environment"
				selection={selection ?? allEnvironmentsTag}
				onSelectionChange={(value: string) =>
					onSelectionChange(value === allEnvironmentsTag ? undefined : value)
				}
				modifiers={[pickerStyle('inline'), labelsHidden()]}
			>
				<Text modifiers={[tag(allEnvironmentsTag)]}>All Environments</Text>
				{environments.map((environment) => (
					<Text key={environment.id} modifiers={[tag(environment.id)]}>
						{environmentTitle(environment)}
					</Text>
				))}
			</Picker>
		</Section>
	);
}

export function EnvironmentLoadFailuresSection({
	failures,
	retry
}: EnvironmentLoadFailuresSectionProps) {
	if (failures.length === 0) return null;
	return (
		<Section>
			{failures.map((failure) => (
				<VStack key={failure.id} alignment="leading" spacing={4}>
					<Label
						title={`Couldn't load ${environmentTitle(failure.environment)}`}
						systemImage="exclamationmark.triangle"
					/>
					<Text
						modifiers={[
							font({ textStyle: 'footnote' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{failure.message}
					</Text>
				</VStack>
			))}
			<Button label="Retry" onPress={retry} />
		</Section>
	);
}

export function EnvironmentActionButton({
	title,
	systemImage,
	environments,
	action
}: EnvironmentActionButtonProps) {
	const first = environments[0];
	if (environmentActionIsMenu(environments)) {
		return (
			<Menu label={<Label title={title} systemImage={systemImage as SFSymbol} />}>
				{environments.map((environment) => (
					<Button
						key={environment.id}
						label={environmentTitle(environment)}
						onPress={() => action(environment.id)}
					/>
				))}
			</Menu>
		);
	}
	if (!first) return null;
	return (
		<Button label={title} systemImage={systemImage as SFSymbol} onPress={() => action(first.id)} />
	);
}
