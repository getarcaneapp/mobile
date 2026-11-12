export type FirebaseSettings = {
	projectId: string;
	applicationId: string;
	apiKey: string;
	senderId: string;
};

export const emptyFirebaseSettings: FirebaseSettings = {
	projectId: '',
	applicationId: '',
	apiKey: '',
	senderId: ''
};

export type FirebaseParseResult =
	| { ok: true; settings: FirebaseSettings }
	| { ok: false; message: string };

const applicationIdPattern = /^\d+:(\d+):android:[0-9a-f]+$/;

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function record(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

export function validateFirebaseSettings(settings: FirebaseSettings): string | undefined {
	if (!settings.projectId.trim()) return 'Enter the project ID.';
	if (!settings.applicationId.trim()) return 'Enter the app ID.';
	if (!settings.apiKey.trim()) return 'Enter the API key.';
	if (!settings.senderId.trim()) return 'Enter the sender ID.';
	if (!/^\d+$/.test(settings.senderId.trim())) return 'The sender ID has digits only.';
	const match = applicationIdPattern.exec(settings.applicationId.trim());
	if (!match) return 'The app ID must look like 1:123456789:android:abc123.';
	if (match[1] !== settings.senderId.trim()) return 'The app ID and the sender ID do not match.';
	return undefined;
}

export function parseGoogleServices(raw: string, packageName: string): FirebaseParseResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { ok: false, message: 'This is not valid JSON.' };
	}
	const root = record(parsed);
	const info = record(root?.project_info);
	const clients = Array.isArray(root?.client) ? (root.client as unknown[]) : [];
	if (!root || !info || clients.length === 0)
		return { ok: false, message: 'This is not a google-services.json file.' };

	const entries = clients.map(record).filter((client) => client !== undefined);
	const match = entries.find(
		(client) =>
			text(record(record(client.client_info)?.android_client_info)?.package_name) === packageName
	);
	if (!match)
		return { ok: false, message: `The file has no Android app with the package ${packageName}.` };

	const keys = Array.isArray(match.api_key) ? (match.api_key as unknown[]) : [];
	const settings: FirebaseSettings = {
		projectId: text(info.project_id),
		applicationId: text(record(match.client_info)?.mobilesdk_app_id),
		apiKey: text(record(keys[0])?.current_key),
		senderId: text(info.project_number)
	};
	const problem = validateFirebaseSettings(settings);
	return problem ? { ok: false, message: problem } : { ok: true, settings };
}
