import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Button, Form, NavigationStack, Toolbar, ToolbarItem } from '@expo/ui/swift-ui';
import {
	disabled as disabledModifier,
	navigationTitle,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { ToastHost } from '@/ui/toast';

export type BackupFormConfirm = { label: string; disabled: boolean; onPress: () => void };

export function BackupFormChrome({
	title,
	presentation,
	confirm,
	onCancel,
	disabled = false,
	formModifiers = [],
	children
}: {
	title: string;
	presentation: 'push' | 'sheet';
	confirm?: BackupFormConfirm;
	onCancel?: () => void;
	disabled?: boolean;
	formModifiers?: ModifierConfig[];
	children: ReactNode;
}) {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const accent = useAccentColor();
	const modifiers = [...formModifiers, disabledModifier(disabled)];

	if (presentation === 'push') {
		return (
			<>
				<Stack.Screen options={{ title }} />
				{confirm ? (
					<AppToolbar placement="right" tintColor={accent}>
						<Stack.Toolbar.Button
							variant="plain"
							style={{ fontWeight: '600' }}
							disabled={confirm.disabled || disabled}
							onPress={confirm.onPress}
						>
							{confirm.label}
						</Stack.Toolbar.Button>
					</AppToolbar>
				) : null}
				<Host style={{ flex: 1 }}>
					<Form modifiers={modifiers}>{children}</Form>
				</Host>
			</>
		);
	}

	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form modifiers={[navigationTitle(title), ...modifiers]}>{children}</Form>
						<Toolbar.Content>
							{onCancel ? (
								<ToolbarItem placement="cancellationAction">
									<Button label="Cancel" onPress={onCancel} />
								</ToolbarItem>
							) : null}
							{confirm ? (
								<ToolbarItem placement="confirmationAction">
									<Button
										label={confirm.label}
										onPress={confirm.onPress}
										modifiers={[disabledModifier(confirm.disabled || disabled), ...toolbarSymbol]}
									/>
								</ToolbarItem>
							) : null}
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
