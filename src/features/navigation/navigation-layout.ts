export type NavigationLayout = 'tabBar' | 'sidebar' | 'rail';

export const sidebarMinimumWidth = 700;
export const railMinimumWidth = 600;
export const railWidth = 80;
export const readableContentWidth = 840;

export function navigationLayoutFor(os: string, isPad: boolean, width: number): NavigationLayout {
	if (os === 'ios') return isPad && width >= sidebarMinimumWidth ? 'sidebar' : 'tabBar';
	if (os === 'android') return width >= railMinimumWidth ? 'rail' : 'tabBar';
	return 'tabBar';
}

export function sidebarWidthFor(width: number): number {
	return width >= 1100 ? 320 : 280;
}

export function readableContentInset(layout: NavigationLayout, width: number): number {
	if (layout !== 'rail') return 0;
	const pane = contentPaneWidth(layout, width);
	return pane > readableContentWidth ? Math.floor((pane - readableContentWidth) / 2) : 0;
}

export function contentPaneWidth(layout: NavigationLayout, width: number): number {
	if (layout === 'sidebar') return width - sidebarWidthFor(width);
	if (layout === 'rail') return width - railWidth;
	return width;
}
