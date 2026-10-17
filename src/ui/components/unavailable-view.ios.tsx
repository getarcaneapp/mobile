/**
 * `ContentUnavailableView` with an actions row (expo-ui's view has no
 * `actions:` slot, so the buttons stack below it).
 *
 * SwiftUI-tree.
 */
import { Button, ContentUnavailableView, Group, ProgressView, VStack } from '@expo/ui/swift-ui';
import type { ModifierConfig } from '@expo/ui/swift-ui/modifiers';
import { disabled, fixedSize, font, frame, padding } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { UnavailableViewProps } from './unavailable-view.types';

export type { UnavailableAction, UnavailableViewProps } from './unavailable-view.types';

/**
 * Measured against the reference app's native `actions:` slot (Variables empty
 * state): actions sit ~38pt under the description in `.subheadline`, and the
 * group is centered ~7pt higher than a plain VStack centers it. expo-ui's
 * ContentUnavailableView keeps its own bottom padding, hence the negative spacing.
 */
const actionsSpacing = -17;
const actionsLift = 14;

export function UnavailableView({
	title,
	systemImage,
	description,
	actions = [],
	fills = true,
	children,
	modifiers = []
}: UnavailableViewProps & { modifiers?: ModifierConfig[] }) {
	const hasActions = actions.length > 0 || children != null;
	return (
		<VStack
			spacing={hasActions ? actionsSpacing : 0}
			modifiers={[
				frame(fills ? { maxWidth: Infinity, maxHeight: Infinity } : { maxWidth: Infinity }),
				padding({ bottom: hasActions && fills ? actionsLift : 0 }),
				...modifiers
			]}
		>
			<ContentUnavailableView
				modifiers={[fixedSize({ horizontal: false, vertical: true })]}
				title={title}
				systemImage={systemImage as SFSymbol}
				description={description}
			/>
			{actions.map((action) =>
				action.isBusy ? (
					<ProgressView key={action.title} />
				) : (
					<Button
						key={action.title}
						label={action.title}
						onPress={action.onPress}
						modifiers={[font({ textStyle: 'subheadline' }), disabled(action.disabled ?? false)]}
					/>
				)
			)}
			{children != null ? (
				<Group modifiers={[font({ textStyle: 'subheadline' })]}>{children}</Group>
			) : null}
		</VStack>
	);
}
