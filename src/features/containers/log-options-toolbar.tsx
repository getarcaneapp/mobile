/** `LogOptionsMenu` as the dedicated log viewer's toolbar menu (both platforms). */
import { Stack } from 'expo-router';

import type { AndroidMenuItem } from './android-toolbar';
import type { LogViewerModel } from './use-log-viewer';

/** The dedicated viewer's trailing `ellipsis.circle` options menu. */
/** Called as a function (not a component) so `Stack.Toolbar` sees a `Stack.Toolbar.Menu` child on iOS. */
export function logOptionsToolbarMenu(model: LogViewerModel) {
	const empty = model.snapshot.lines.length === 0;
	return (
		<Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="Log options">
			<Stack.Toolbar.MenuAction
				icon="clock"
				isOn={model.showTimestamps}
				onPress={() => model.setShowTimestamps(!model.showTimestamps)}
			>
				Timestamps
			</Stack.Toolbar.MenuAction>
			<Stack.Toolbar.MenuAction
				icon="text.justify.left"
				isOn={model.wrapLines}
				onPress={() => model.setWrapLines(!model.wrapLines)}
			>
				Wrap Lines
			</Stack.Toolbar.MenuAction>
			<Stack.Toolbar.Menu inline>
				<Stack.Toolbar.MenuAction icon="doc.on.doc" disabled={empty} onPress={model.copyLogs}>
					Copy All
				</Stack.Toolbar.MenuAction>
				<Stack.Toolbar.MenuAction
					icon="square.and.arrow.up"
					disabled={empty}
					onPress={model.shareLogs}
				>
					Share All…
				</Stack.Toolbar.MenuAction>
			</Stack.Toolbar.Menu>
			<Stack.Toolbar.Menu inline>
				<Stack.Toolbar.MenuAction
					icon="trash"
					destructive
					disabled={empty}
					onPress={() => model.store.clear()}
				>
					Clear
				</Stack.Toolbar.MenuAction>
			</Stack.Toolbar.Menu>
		</Stack.Toolbar.Menu>
	);
}

/** The same options as Android popup-menu items. */
export function logOptionsMenuItems(model: LogViewerModel): AndroidMenuItem[] {
	const empty = model.snapshot.lines.length === 0;
	return [
		{
			id: 'timestamps',
			title: 'Timestamps',
			checked: model.showTimestamps,
			onPress: () => model.setShowTimestamps(!model.showTimestamps)
		},
		{
			id: 'wrap',
			title: 'Wrap Lines',
			checked: model.wrapLines,
			onPress: () => model.setWrapLines(!model.wrapLines)
		},
		{ id: 'copy', title: 'Copy All', disabled: empty, onPress: model.copyLogs },
		{ id: 'share', title: 'Share All…', disabled: empty, onPress: model.shareLogs },
		{
			id: 'clear',
			title: 'Clear',
			destructive: true,
			disabled: empty,
			onPress: () => model.store.clear()
		}
	];
}
