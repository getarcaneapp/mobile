import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { withoutSwarmLogDetails } from '../networking/swarm-log-details';

describe('withoutSwarmLogDetails', () => {
	it('removes the swarm task details prefix', () => {
		assert.equal(
			withoutSwarmLogDetails(
				'com.docker.swarm.node.id=yq,com.docker.swarm.service.id=bv,com.docker.swarm.task.id=n5 /docker-entrypoint.sh: ready'
			),
			'/docker-entrypoint.sh: ready'
		);
	});

	it('leaves other lines alone', () => {
		assert.equal(withoutSwarmLogDetails('plain message'), 'plain message');
	});
});
