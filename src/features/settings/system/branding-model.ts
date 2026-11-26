import { appendingAPIPath } from '@/sdk/client/url';
import { BrandImageSlot } from '@/sdk/models/settings/BrandImage';
import type { PublicSetting } from '@/sdk/models/settings/Settings';

export type BrandSlotDef = {
	slot: BrandImageSlot;
	title: string;
	hint: string;
	systemImage: string;
	mimeTypes: string[];
	extensions: string[];
};

const logoMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const logoExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

export const brandSlots: BrandSlotDef[] = [
	{
		slot: 'mark',
		title: 'Icon Mark',
		hint: 'PNG, JPEG, WebP or SVG',
		systemImage: 'app.fill',
		mimeTypes: logoMimeTypes,
		extensions: logoExtensions
	},
	{
		slot: 'full',
		title: 'Full Logo',
		hint: 'PNG, JPEG, WebP or SVG',
		systemImage: 'photo',
		mimeTypes: logoMimeTypes,
		extensions: logoExtensions
	},
	{
		slot: 'favicon',
		title: 'Favicon',
		hint: 'PNG, SVG or ICO',
		systemImage: 'globe',
		mimeTypes: ['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'],
		extensions: ['.png', '.svg', '.ico']
	},
	{
		slot: 'pwa',
		title: 'App Icon',
		hint: 'Square PNG, 512×512 or larger',
		systemImage: 'square.grid.2x2',
		mimeTypes: ['image/png'],
		extensions: ['.png']
	}
];

export const brandImageMaxMB = 2;
export const brandImageMaxBytes = brandImageMaxMB * 1024 * 1024;

const mimeByExtension: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon'
};

export function brandSlotFooter(def: BrandSlotDef): string {
	return `${def.hint}, up to ${brandImageMaxMB} MB.`;
}

export type PickedBrandFile = { name: string; type?: string; size?: number };

function extensionOf(name: string): string {
	const match = /\.[A-Za-z0-9]+$/.exec(name);
	return match ? match[0].toLowerCase() : '';
}

export function brandImageContentType(
	def: BrandSlotDef,
	file: PickedBrandFile
): string | undefined {
	const type = file.type?.toLowerCase() ?? '';
	if (def.mimeTypes.includes(type)) return type;
	const extension = extensionOf(file.name);
	if (!def.extensions.includes(extension)) return undefined;
	return mimeByExtension[extension];
}

export function brandImageError(def: BrandSlotDef, file: PickedBrandFile): string | undefined {
	if (brandImageContentType(def, file) === undefined) return `Use ${def.hint}.`;
	if ((file.size ?? 0) > brandImageMaxBytes)
		return `Images must be ${brandImageMaxMB} MB or smaller.`;
	return undefined;
}

export type BrandHashes = Record<BrandImageSlot, string>;

export const emptyBrandHashes: BrandHashes = { mark: '', full: '', favicon: '', pwa: '' };

export function brandHashes(settings: readonly PublicSetting[]): BrandHashes {
	const values = new Map(settings.map((setting) => [setting.key, setting.value]));
	return {
		mark: values.get(BrandImageSlot.hashKey('mark')) ?? '',
		full: values.get(BrandImageSlot.hashKey('full')) ?? '',
		favicon: values.get(BrandImageSlot.hashKey('favicon')) ?? '',
		pwa: values.get(BrandImageSlot.hashKey('pwa')) ?? ''
	};
}

export function developmentBrandingEnabled(settings: readonly PublicSetting[]): boolean {
	const setting = settings.find((item) => item.key === 'developmentBrandingEnabled');
	return setting?.value.trim().toLowerCase() !== 'false';
}

export function isDevelopmentBuild(
	version: { currentVersion: string; isStableVersion?: boolean } | undefined
): boolean {
	return !!version && version.currentVersion.trim() !== '' && version.isStableVersion === false;
}

export function brandPreviewPath(
	slot: BrandImageSlot,
	hash: string,
	usesDevelopmentBranding: boolean
): string {
	switch (slot) {
		case 'mark':
		case 'full': {
			const params: string[] = [];
			if (slot === 'full') params.push('full=true');
			if (hash !== '') params.push(`custom=${encodeURIComponent(hash)}`);
			else if (usesDevelopmentBranding) params.push('branding=development');
			return params.length === 0 ? 'app/images/logo' : `app/images/logo?${params.join('&')}`;
		}
		case 'favicon':
			return `app/images/favicon?v=${encodeURIComponent(hash)}`;
		case 'pwa':
			return `app/images/pwa/icon-192x192.png?v=${encodeURIComponent(hash)}`;
	}
}

export function brandPreviewURL(
	serverURL: string,
	slot: BrandImageSlot,
	hash: string,
	usesDevelopmentBranding: boolean
): string | undefined {
	if (serverURL === '') return undefined;
	const path = brandPreviewPath(slot, hash, usesDevelopmentBranding);
	const [route = '', query] = path.split('?');
	const base = appendingAPIPath(serverURL, route);
	if (!query) return base;
	return `${base}${base.includes('?') ? '&' : '?'}${query}`;
}
