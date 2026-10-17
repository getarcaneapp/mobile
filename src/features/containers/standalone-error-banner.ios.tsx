/** `ErrorBanner` for RN trees on iOS (its own Host). */
import { Host } from '@/ui/host';

import { ErrorBanner } from '@/ui/components/error-banner';
import type { ErrorBannerProps } from '@/ui/components/error-banner.types';

export function StandaloneErrorBanner(props: ErrorBannerProps) {
	return (
		<Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
			<ErrorBanner {...props} />
		</Host>
	);
}
