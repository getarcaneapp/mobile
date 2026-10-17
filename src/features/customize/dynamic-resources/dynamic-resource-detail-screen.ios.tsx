/** Port of `DynamicResourceDetailView` + `DynamicValueRow` (DynamicResourceViews.swift). */
import { Host } from '@/ui/host';
import { DisclosureGroup, Label, LabeledContent, List, Section, Text } from '@expo/ui/swift-ui';
import { foregroundStyle, listStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';

import {
	isJSONObject,
	jsonDisplayString,
	prettyKey,
	standardCompare,
	type JSONValue
} from './dynamic-resource';
import { useDynamicResourceDetail } from './use-dynamic-resource-detail';

/** Port of `DynamicValueRow`. SwiftUI-tree. */
export function DynamicValueRow({ name, value }: { name: string; value: JSONValue }) {
	if (isJSONObject(value)) {
		return (
			<DisclosureGroup label={prettyKey(name)}>
				{Object.entries(value)
					.sort(([lhs], [rhs]) => standardCompare(lhs, rhs))
					.map(([childKey, childValue]) => (
						<DynamicValueRow key={childKey} name={childKey} value={childValue} />
					))}
			</DisclosureGroup>
		);
	}
	if (Array.isArray(value)) {
		return (
			<DisclosureGroup label={`${prettyKey(name)} (${value.length})`}>
				{value.map((childValue, index) => (
					<DynamicValueRow key={index} name={String(index + 1)} value={childValue} />
				))}
			</DisclosureGroup>
		);
	}
	return (
		<LabeledContent label={prettyKey(name)}>
			<Text>{jsonDisplayString(value)}</Text>
		</LabeledContent>
	);
}

export function DynamicResourceDetailScreen() {
	const model = useDynamicResourceDetail();
	const accent = useAccentColor();
	return (
		<>
			<Stack.Screen options={{ title: model.title }} />
			{model.showsMenu ? (
				<AppToolbar placement="right" tintColor={accent}>
					<Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="Actions">
						{model.canEdit ? (
							<Stack.Toolbar.MenuAction icon="pencil" onPress={model.presentEdit}>
								Edit
							</Stack.Toolbar.MenuAction>
						) : null}
						{model.actions.map((action) => (
							<Stack.Toolbar.MenuAction
								key={action.id}
								icon={action.systemImage as SFSymbol}
								destructive={action.destructive}
								onPress={() => void model.run(action)}
							>
								{action.title}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					{model.actionMessage !== undefined ? (
						<Section>
							<Label
								title={model.actionMessage}
								systemImage="checkmark.circle"
								modifiers={[foregroundStyle(systemColors.green)]}
							/>
						</Section>
					) : null}
					{model.errorMessage !== undefined ? (
						<Section>
							<Label
								title={model.errorMessage}
								systemImage="exclamationmark.triangle"
								modifiers={[foregroundStyle(systemColors.red)]}
							/>
						</Section>
					) : null}
					<Section title="Details">
						{model.details.map(([key, value]) => (
							<DynamicValueRow key={key} name={key} value={value} />
						))}
					</Section>
				</List>
			</Host>
		</>
	);
}
