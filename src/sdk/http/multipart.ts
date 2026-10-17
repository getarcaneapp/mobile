export interface MultipartFile {
	fieldName: string;
	filename: string;
	contentType?: string;
	uri?: string;
	data?: Blob | Uint8Array | ArrayBuffer;
}

export interface MultipartEndpoint {
	path: string;
	method: string;
	query: import('../client/url').QueryItem[];
	fields: Record<string, string>;
	files: MultipartFile[];
}

export const uriPartSource = Symbol.for('arcane.multipart.uriPart');

interface URIPart {
	name: string;
	type: string;
	bytes(): Promise<Uint8Array>;
	[uriPartSource]: { uri: string; filename: string; type: string };
}

export function singleURIPartUpload(body: unknown):
	| {
			fieldName: string;
			uri: string;
			filename: string;
			type: string;
			fields: Record<string, string>;
	  }
	| undefined {
	if (typeof FormData === 'undefined' || !(body instanceof FormData)) return undefined;
	const entries = (body as unknown as { entries?: () => Iterable<[string, unknown]> }).entries?.();
	if (!entries) return undefined;
	const fields: Record<string, string> = {};
	let file: { fieldName: string; uri: string; filename: string; type: string } | undefined;
	for (const [name, value] of entries) {
		if (typeof value === 'string') {
			if (name in fields) return undefined;
			fields[name] = value;
			continue;
		}
		const source =
			typeof value === 'object' && value !== null
				? (value as Partial<URIPart>)[uriPartSource]
				: undefined;
		if (!source || file) return undefined;
		file = { fieldName: name, ...source };
	}
	return file ? { ...file, fields } : undefined;
}

export function makeMultipartFormData(
	fields: Record<string, string>,
	files: readonly MultipartFile[]
): FormData {
	const form = new FormData();
	for (const [name, value] of Object.entries(fields)) {
		form.append(name, value);
	}
	for (const file of files) {
		const type = file.contentType ?? 'application/octet-stream';
		if (file.uri !== undefined) {
			const uri = file.uri;
			const part: URIPart = {
				name: file.filename,
				type,
				bytes: async () => {
					const { File } = require('expo-file-system') as typeof import('expo-file-system');
					return new Uint8Array(await new File(uri).arrayBuffer());
				},
				[uriPartSource]: { uri, filename: file.filename, type }
			};
			form.append(file.fieldName, part as unknown as Blob);
		} else if (file.data !== undefined) {
			const blob =
				file.data instanceof Blob
					? file.data
					: new Blob([file.data instanceof Uint8Array ? copyBytes(file.data) : file.data], {
							type
						});
			form.append(file.fieldName, blob, file.filename);
		} else {
			throw new Error(`MultipartFile "${file.fieldName}" needs a uri or data`);
		}
	}
	return form;
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
	const copy = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(copy).set(bytes);
	return copy;
}
