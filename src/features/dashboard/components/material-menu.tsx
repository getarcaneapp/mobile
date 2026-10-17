/**
 * Compose `DropdownMenu` anchored to its RN parent — the Android rendering of
 * the dashboard's SwiftUI `.contextMenu`s (opened by a long press).
 *
 * Standalone. Android only (Compose); import it from `.android.tsx` files.
 */
import { Host } from '@expo/ui';
import {
	DropdownMenu,
	DropdownMenuItem,
	HorizontalDivider,
	Text as ComposeText
} from '@expo/ui/jetpack-compose';

import { systemColors } from '@/theme/colors';

export type MenuEntry =
	| { kind: 'divider'; id: string }
	| {
			kind: 'item';
			id: string;
			title: string;
			systemImage?: string;
			destructive?: boolean;
			disabled?: boolean;
			onPress: () => void;
	  };

export function MaterialMenu({
	expanded,
	onDismiss,
	entries
}: {
	expanded: boolean;
	onDismiss: () => void;
	entries: MenuEntry[];
}) {
	return (
		<Host matchContents style={{ position: 'absolute', left: 16, bottom: 0 }}>
			<DropdownMenu expanded={expanded} onDismissRequest={onDismiss}>
				<DropdownMenu.Items>
					{entries.map((entry) =>
						entry.kind === 'divider' ? (
							<HorizontalDivider key={entry.id} />
						) : (
							<DropdownMenuItem
								key={entry.id}
								enabled={!entry.disabled}
								onClick={() => {
									onDismiss();
									entry.onPress();
								}}
							>
								<DropdownMenuItem.Text>
									<ComposeText color={entry.destructive ? systemColors.red : undefined}>
										{entry.title}
									</ComposeText>
								</DropdownMenuItem.Text>
							</DropdownMenuItem>
						)
					)}
				</DropdownMenu.Items>
			</DropdownMenu>
		</Host>
	);
}
