import {
	Button,
	DisclosureGroup,
	Divider,
	HStack,
	ProgressView,
	ScrollView,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	accessibilityLabel,
	background,
	buttonStyle,
	contentShape,
	defaultScrollAnchor,
	defaultScrollAnchorForRole,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	monospacedDigit,
	padding,
	shapes,
	textSelection,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import type { EnvironmentUpdateResult } from '@/sdk/models/system/Upgrade';
import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Image } from '@/ui/components/swiftui-image';
import { glassEffectCompat } from '@/ui/components/swiftui-surfaces';

import {
	upgradeResultDetail,
	upgradeResultIsManager,
	upgradeResultLabel,
	upgradeResultSymbol,
	upgradeResultTint,
	type UpgradeResultTint
} from './upgrade-job-display';
import { resultLogs } from './upgrade-job-follow';
import type {
	UpdateTargetPickerProps,
	UpgradeJobResultListProps,
	UpgradeLogsProps
} from './upgrade-job-results.types';

const secondary = { type: 'hierarchical', style: 'secondary' } as const;

function useTint(): (tint: UpgradeResultTint) => string {
	const accent = useAccentColor();
	return (value) => {
		switch (value) {
			case 'accent':
				return accent;
			case 'green':
				return systemColors.green;
			case 'orange':
				return systemColors.orange;
			case 'red':
				return systemColors.red;
			case 'gray':
				return systemColors.gray;
		}
	};
}

export function UpgradeLogs({ logs, maxHeight = 220 }: UpgradeLogsProps) {
	const text = resultLogs(logs);
	if (!text) {
		return (
			<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(secondary)]}>
				No logs yet
			</Text>
		);
	}
	return (
		<ScrollView
			modifiers={[
				frame({ maxWidth: Infinity, maxHeight }),
				defaultScrollAnchor('bottom'),
				defaultScrollAnchorForRole('bottom', 'sizeChanges'),
				background(
					withOpacity(systemColors.gray, 0.12),
					shapes.roundedRectangle({ cornerRadius: Radius.nested })
				)
			]}
		>
			<Text
				modifiers={[
					font({ textStyle: 'caption2', design: 'monospaced' }),
					textSelection(true),
					frame({ maxWidth: Infinity, alignment: 'leading' }),
					padding({ all: 12 })
				]}
			>
				{text}
			</Text>
		</ScrollView>
	);
}

function ResultRow({
	result,
	expandsLogs
}: {
	result: EnvironmentUpdateResult;
	expandsLogs: boolean;
}) {
	const color = useTint()(upgradeResultTint(result));
	const [showsLogs, setShowsLogs] = useState(expandsLogs);
	const detail = upgradeResultDetail(result);
	const percent = Math.max(0, Math.min(100, result.percent ?? 0));
	return (
		<VStack alignment="leading" spacing={10} modifiers={[padding({ vertical: 12 })]}>
			<HStack spacing={12}>
				<Image
					systemName={upgradeResultSymbol(result) as never}
					modifiers={[font({ textStyle: 'title3' }), foregroundStyle(color)]}
				/>
				<VStack alignment="leading" spacing={2}>
					<HStack spacing={6}>
						<Text
							modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), lineLimit(1)]}
						>
							{result.environmentName || result.environmentId}
						</Text>
						{upgradeResultIsManager(result) ? (
							<Text
								modifiers={[
									font({ textStyle: 'caption2', weight: 'medium' }),
									foregroundStyle(secondary),
									padding({ horizontal: 6, vertical: 1 }),
									background(withOpacity(systemColors.gray, 0.16), shapes.capsule())
								]}
							>
								Manager
							</Text>
						) : null}
					</HStack>
					{detail ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle(secondary),
								monospacedDigit(),
								lineLimit(2)
							]}
						>
							{detail}
						</Text>
					) : null}
				</VStack>
				<Spacer minLength={8} />
				<Text
					modifiers={[
						font({ textStyle: 'caption', weight: 'medium' }),
						foregroundStyle(color),
						lineLimit(1)
					]}
				>
					{upgradeResultLabel(result)}
				</Text>
			</HStack>
			{result.status === 'updating' ? (
				<HStack spacing={8}>
					<ProgressView
						value={percent / 100}
						modifiers={[
							tint(color),
							accessibilityLabel(`${result.environmentName} ${percent}% complete`)
						]}
					/>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							monospacedDigit(),
							foregroundStyle(secondary)
						]}
					>
						{`${percent}%`}
					</Text>
				</HStack>
			) : null}
			<DisclosureGroup
				label="Logs"
				isExpanded={showsLogs}
				onIsExpandedChange={setShowsLogs}
				modifiers={[font({ textStyle: 'footnote' })]}
			>
				<UpgradeLogs logs={result.logs} />
			</DisclosureGroup>
		</VStack>
	);
}

export function UpgradeJobResultList({ results, expandsLogs = false }: UpgradeJobResultListProps) {
	return (
		<VStack
			alignment="leading"
			spacing={0}
			modifiers={[
				padding({ horizontal: 16, vertical: 4 }),
				frame({ maxWidth: Infinity, alignment: 'leading' }),
				glassEffectCompat({ shape: 'roundedRectangle', cornerRadius: Radius.card })
			]}
		>
			{results.map((result, index) => (
				<VStack key={result.environmentId} alignment="leading" spacing={0}>
					{index > 0 ? <Divider /> : null}
					<ResultRow result={result} expandsLogs={expandsLogs || results.length === 1} />
				</VStack>
			))}
		</VStack>
	);
}

export function UpdateTargetPicker({
	candidates,
	selected,
	onToggle,
	onSelectAll,
	onSelectNone
}: UpdateTargetPickerProps) {
	const accent = useAccentColor();
	const allSelected = selected.length === candidates.length;
	return (
		<VStack alignment="leading" spacing={8}>
			<HStack>
				<Text modifiers={[font({ textStyle: 'headline' })]}>Environments</Text>
				<Spacer />
				<Button
					label={allSelected ? 'Select None' : 'Select All'}
					onPress={allSelected ? onSelectNone : onSelectAll}
					modifiers={[font({ textStyle: 'subheadline' })]}
				/>
			</HStack>
			<VStack
				alignment="leading"
				spacing={0}
				modifiers={[
					padding({ horizontal: 16, vertical: 4 }),
					glassEffectCompat({ shape: 'roundedRectangle', cornerRadius: Radius.card })
				]}
			>
				{candidates.map((candidate, index) => {
					const isSelected = selected.includes(candidate.id);
					return (
						<VStack key={candidate.id} alignment="leading" spacing={0}>
							{index > 0 ? <Divider /> : null}
							<Button
								onPress={() => onToggle(candidate.id)}
								modifiers={[
									buttonStyle('plain'),
									accessibilityLabel(
										`${candidate.name}, ${isSelected ? 'selected' : 'not selected'}`
									)
								]}
							>
								<HStack
									spacing={12}
									modifiers={[padding({ vertical: 12 }), contentShape(shapes.rectangle())]}
								>
									<Image
										systemName={isSelected ? 'checkmark.circle.fill' : 'circle'}
										modifiers={[
											font({ textStyle: 'title3' }),
											foregroundStyle(isSelected ? accent : systemColors.gray)
										]}
									/>
									<VStack alignment="leading" spacing={2}>
										<HStack spacing={6}>
											<Text
												modifiers={[
													font({ textStyle: 'subheadline', weight: 'semibold' }),
													foregroundStyle('primary'),
													lineLimit(1)
												]}
											>
												{candidate.name}
											</Text>
											{candidate.isManager ? (
												<Text
													modifiers={[
														font({ textStyle: 'caption2', weight: 'medium' }),
														foregroundStyle(secondary),
														padding({ horizontal: 6, vertical: 1 }),
														background(withOpacity(systemColors.gray, 0.16), shapes.capsule())
													]}
												>
													Manager
												</Text>
											) : null}
										</HStack>
										{candidate.version ? (
											<Text
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle(secondary),
													lineLimit(1)
												]}
											>
												{candidate.version}
											</Text>
										) : null}
									</VStack>
									<Spacer minLength={8} />
									<Text
										modifiers={[
											font({ textStyle: 'caption', weight: 'medium' }),
											foregroundStyle(
												!candidate.online
													? systemColors.gray
													: candidate.updateAvailable
														? systemColors.green
														: secondary
											),
											lineLimit(1)
										]}
									>
										{!candidate.online
											? 'Offline'
											: candidate.updateAvailable
												? 'Update Available'
												: candidate.updateAvailable === false
													? 'Up to Date'
													: ''}
									</Text>
								</HStack>
							</Button>
						</VStack>
					);
				})}
			</VStack>
		</VStack>
	);
}
