export type BrandImageSlot = 'mark' | 'full' | 'favicon' | 'pwa';

export const BrandImageSlot = {
	knownCases: ['mark', 'full', 'favicon', 'pwa'] as const,
	uploadPath(this: void, slot: BrandImageSlot): string {
		switch (slot) {
			case 'mark':
				return 'app/images/logo/mark';
			case 'full':
				return 'app/images/logo/full';
			case 'favicon':
				return 'app/images/favicon';
			case 'pwa':
				return 'app/images/pwa';
		}
	},
	hashKey(this: void, slot: BrandImageSlot): string {
		switch (slot) {
			case 'mark':
				return 'customLogoHash';
			case 'full':
				return 'customLogoFullHash';
			case 'favicon':
				return 'customFaviconHash';
			case 'pwa':
				return 'customPwaIconHash';
		}
	}
} as const;
