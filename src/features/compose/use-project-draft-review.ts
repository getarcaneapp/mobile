import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { routePayloads, type DraftReviewPayload } from '@/features/projects/project-routes';

import { ProjectDraftReview } from './model/project-draft-snapshot';

export function useProjectDraftReview() {
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => routePayloads.get<DraftReviewPayload>(token));
	const chosen = useRef<boolean | undefined>(undefined);
	useEffect(
		() => () => {
			routePayloads.delete(token);
			if (chosen.current !== undefined) {
				const deploy = chosen.current;
				setTimeout(() => payload?.onDismiss(deploy), 0);
			}
		},
		[token, payload]
	);

	const dismiss = () => {
		if (router.canGoBack()) router.back();
	};
	const originalCompose = payload?.originalCompose ?? '';
	const compose = payload?.compose ?? '';
	const draft = { compose, environment: '' };
	const original = { compose: originalCompose, environment: '' };

	return {
		composeChanged: originalCompose !== compose,
		serviceChanges: ProjectDraftReview.serviceChanges(draft, original),
		sourceDiff: ProjectDraftReview.sourceDiff(draft, original),
		environmentChanged: payload?.environmentChanged ?? false,
		additionalChanges: [...new Set(payload?.additionalChanges ?? [])].sort(),
		saveTitle: payload?.saveTitle ?? 'Save',
		canDeploy: payload?.canDeploy ?? false,
		cancel: dismiss,
		save: (deploy: boolean) => {
			chosen.current = deploy;
			dismiss();
		}
	};
}

export type ProjectDraftReviewModel = ReturnType<typeof useProjectDraftReview>;
