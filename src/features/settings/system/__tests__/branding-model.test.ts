import { describe, expect, it } from 'vite-plus/test';

import type { PublicSetting } from '@/sdk/models/settings/Settings';

import {
	brandHashes,
	brandImageContentType,
	brandImageError,
	brandImageMaxBytes,
	brandPreviewPath,
	brandPreviewURL,
	brandSlotFooter,
	brandSlots,
	developmentBrandingEnabled,
	isDevelopmentBuild
} from '../branding-model';

const slot = (id: string) => brandSlots.find((def) => def.slot === id)!;

const setting = (key: string, value: string): PublicSetting => ({ key, value, type: 'string' });

describe('brand image validation', () => {
	it('accepts matching MIME types or extensions', () => {
		expect(brandImageContentType(slot('mark'), { name: 'logo.svg' })).toBe('image/svg+xml');
		expect(brandImageContentType(slot('mark'), { name: 'logo', type: 'image/webp' })).toBe(
			'image/webp'
		);
		expect(brandImageContentType(slot('favicon'), { name: 'favicon.ICO' })).toBe('image/x-icon');
		expect(brandImageContentType(slot('pwa'), { name: 'icon.jpg' })).toBeUndefined();
	});

	it('rejects wrong types and oversized files', () => {
		expect(brandImageError(slot('pwa'), { name: 'icon.svg' })).toBe(
			'Use Square PNG, 512×512 or larger.'
		);
		expect(brandImageError(slot('mark'), { name: 'logo.png', size: brandImageMaxBytes + 1 })).toBe(
			'Images must be 2 MB or smaller.'
		);
		expect(brandImageError(slot('mark'), { name: 'logo.png', size: 1024 })).toBeUndefined();
	});

	it('describes each slot with its size limit', () => {
		expect(brandSlotFooter(slot('favicon'))).toBe('PNG, SVG or ICO, up to 2 MB.');
	});
});

describe('brand settings', () => {
	it('reads custom image hashes', () => {
		expect(
			brandHashes([setting('customLogoHash', 'abc'), setting('customPwaIconHash', 'def')])
		).toEqual({ mark: 'abc', full: '', favicon: '', pwa: 'def' });
	});

	it('treats development branding as on unless explicitly false', () => {
		expect(developmentBrandingEnabled([])).toBe(true);
		expect(developmentBrandingEnabled([setting('developmentBrandingEnabled', 'False')])).toBe(
			false
		);
	});

	it('detects development builds only when the server says so', () => {
		expect(isDevelopmentBuild(undefined)).toBe(false);
		expect(isDevelopmentBuild({ currentVersion: '3.1.1' })).toBe(false);
		expect(isDevelopmentBuild({ currentVersion: '3.2.0-next.4', isStableVersion: false })).toBe(
			true
		);
		expect(isDevelopmentBuild({ currentVersion: ' ', isStableVersion: false })).toBe(false);
	});
});

describe('brand previews', () => {
	it('builds logo paths with cache-busting hashes', () => {
		expect(brandPreviewPath('mark', '', false)).toBe('app/images/logo');
		expect(brandPreviewPath('full', 'h1', true)).toBe('app/images/logo?full=true&custom=h1');
		expect(brandPreviewPath('mark', '', true)).toBe('app/images/logo?branding=development');
		expect(brandPreviewPath('pwa', 'p', false)).toBe('app/images/pwa/icon-192x192.png?v=p');
	});

	it('resolves against the server URL and its path prefix', () => {
		expect(brandPreviewURL('', 'mark', '', false)).toBeUndefined();
		expect(brandPreviewURL('https://arcane.example.com/sub', 'favicon', 'x', false)).toBe(
			'https://arcane.example.com/sub/api/app/images/favicon?v=x'
		);
		expect(brandPreviewURL('https://arcane.example.com', 'mark', '', false)).toBe(
			'https://arcane.example.com/api/app/images/logo'
		);
	});
});
