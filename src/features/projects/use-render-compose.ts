import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { scanComposeVariables, substituteComposeVariables } from './project-model';
import { routePayloads, type RenderComposePayload } from './project-routes';

export function useRenderCompose() {
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => routePayloads.get<RenderComposePayload>(token));
	useEffect(() => () => routePayloads.delete(token), [token]);

	const initialCompose = payload?.initialCompose ?? '';
	const [scan] = useState(() => scanComposeVariables(initialCompose, payload?.initialEnv ?? ''));
	const [values, setValues] = useState<Record<string, string>>(() =>
		Object.fromEntries(scan.order.map((name) => [name, scan.defaults[name] ?? '']))
	);
	const [resolved, setResolved] = useState('');
	const [showPreview, setShowPreview] = useState(false);

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};
	const substitute = () => substituteComposeVariables(initialCompose, values, scan.defaults);

	return {
		variableOrder: scan.order,
		defaults: scan.defaults,
		values,
		setValue: (key: string, value: string) =>
			setValues((current) => ({ ...current, [key]: value })),
		resolved,
		showPreview,
		title: showPreview ? 'Resolved YAML' : 'Resolve Variables',
		cancel: dismiss,
		edit: () => setShowPreview(false),
		preview: () => {
			setResolved(substitute());
			setShowPreview(true);
		},
		useResolved: () => {
			payload?.onApply(substitute());
			dismiss();
		}
	};
}
