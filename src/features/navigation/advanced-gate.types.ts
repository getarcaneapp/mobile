import type { ReactNode } from 'react';

import { advancedFeaturesTitle } from '@/core/advanced-tabs';

export type AdvancedGateProps = { children: ReactNode };

export const advancedGateTitle = `${advancedFeaturesTitle} Off`;
export const advancedGateSymbol = 'slider.horizontal.3';
export const advancedGateAction = 'Turn On';
