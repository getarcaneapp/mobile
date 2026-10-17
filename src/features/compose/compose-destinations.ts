/**
 * Pushed screens of the native Compose editor (the Swift `NavigationLink`
 * destinations in Views/Compose). Encoded as strings so iOS can push them as
 * `NavigationLink` values and Android as route params.
 */
import type { ComposeBindingRef } from './compose-session';
import type { ComposeEntryKind } from './model/compose-entry-draft';
import type { ComposeFieldPathComponent } from './model/compose-native-field';

type Base = { binding: ComposeBindingRef; readOnly: boolean };

export type ComposeDestination =
	/** `ComposePreviewEditor` / `EnvPreviewEditor` (the root editors). */
	| (Base & { screen: 'editor'; title: string })
	| (Base & { screen: 'envEditor'; title: string })
	| (Base & { screen: 'service'; service: string; menu: boolean })
	| (Base & { screen: 'imageSettings'; service: string })
	| (Base & { screen: 'runtime'; service: string })
	| (Base & { screen: 'identity'; service: string })
	| (Base & { screen: 'nameResolution'; service: string })
	| (Base & { screen: 'pullPolicy'; service: string })
	| (Base & {
			screen: 'nativeFields';
			fieldPath: ComposeFieldPathComponent[];
			schemaPath: ComposeFieldPathComponent[];
			title: string;
			excluding: string[];
	  })
	| (Base & {
			screen: 'mapping';
			path: string[];
			title: string;
			resource: boolean;
			sensitive: boolean;
	  })
	| (Base & { screen: 'collection'; path: string[]; title: string; kind: ComposeEntryKind })
	| (Base & {
			screen: 'stringList';
			path: string[];
			title: string;
			allowsScalar: boolean;
			environmentFiles: boolean;
	  })
	| (Base & { screen: 'healthcheck'; path: string[] })
	| (Base & { screen: 'networkAttachments'; path: string[] })
	| (Base & { screen: 'networkAttachment'; path: string[]; name: string })
	| (Base & { screen: 'resourceList'; kind: string })
	| (Base & { screen: 'resourceForm'; kind: string; name: string })
	| (Base & { screen: 'envFile'; schemaPath: ComposeFieldPathComponent[] });

const prefix = 'compose:';

export const encodeComposeDestination = (destination: ComposeDestination) =>
	prefix + JSON.stringify(destination);
export const isComposeDestination = (value: string) => value.startsWith(prefix);
export function decodeComposeDestination(value: string): ComposeDestination | undefined {
	if (!isComposeDestination(value)) return undefined;
	try {
		return JSON.parse(value.slice(prefix.length)) as ComposeDestination;
	} catch {
		return undefined;
	}
}

/** `ComposeNativeFieldsForm(text:path:title:readOnly:excluding:schemaPath:)` (the public initializer). */
export function nativeFieldsDestination(
	binding: ComposeBindingRef,
	path: string[],
	title: string,
	readOnly: boolean,
	excluding: string[] = [],
	schemaPath?: ComposeFieldPathComponent[]
): ComposeDestination {
	const fieldPath = path.map((key) => ({ key }));
	return {
		screen: 'nativeFields',
		binding,
		fieldPath,
		schemaPath: schemaPath ?? fieldPath,
		title,
		readOnly,
		excluding
	};
}
