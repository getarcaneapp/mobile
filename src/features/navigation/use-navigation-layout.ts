import { Platform, useWindowDimensions } from 'react-native';

import { contentPaneWidth, navigationLayoutFor, type NavigationLayout } from './navigation-layout';

const isPad = Platform.OS === 'ios' && Platform.isPad;

export function useNavigationLayout(): NavigationLayout {
	const { width } = useWindowDimensions();
	return navigationLayoutFor(Platform.OS, isPad, width);
}

export function useContentPaneWidth(): number {
	const { width } = useWindowDimensions();
	return contentPaneWidth(navigationLayoutFor(Platform.OS, isPad, width), width);
}
