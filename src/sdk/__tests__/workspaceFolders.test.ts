import { describe, expect, it } from 'vite-plus/test';

import { AuthManager } from '../auth/AuthManager';
import { InMemoryTokenStore } from '../auth/TokenStore';
import { APIGenerationState, type APIGeneration } from '../client/apiGeneration';
import { ArcaneTransport } from '../client/ArcaneTransport';
import { EnvironmentID, RetryPolicy } from '../client/environment';
import { RESTService } from '../http/RESTService';
import { ProjectsService } from '../services/ProjectsService';
import { VolumesService } from '../services/VolumesService';
import { isoIn, mockFetch, type MockReply, type RecordedRequest } from './helpers';

const BASE = 'https://arcane.test';

const listing = {
	files: [
		{
			name: 'b',
			path: '/a/b',
			relativePath: 'a/b',
			isDirectory: true,
			isSymlink: false,
			editable: true,
			size: 0,
			modTime: '2026-11-09T00:00:00Z'
		}
	],
	fileTreeRevision: '',
	fileTreeTruncated: false
};

function makeServices(generation: APIGeneration, handler: (request: RecordedRequest) => MockReply) {
	const { fetch, requests } = mockFetch(handler);
	const tokenStore = new InMemoryTokenStore({
		accessToken: 'access',
		refreshToken: 'refresh',
		expiresAt: isoIn(3600)
	});
	const authManager = new AuthManager({ baseURL: BASE, tokenStore, fetch });
	const transport = new ArcaneTransport({
		baseURL: BASE,
		apiGeneration: new APIGenerationState(generation),
		authManager,
		fetch,
		streamingFetch: fetch,
		retryPolicy: RetryPolicy.default
	});
	const rest = new RESTService(transport, EnvironmentID.localDocker);
	return { volumes: new VolumesService(rest), projects: new ProjectsService(rest), requests };
}

const messageReply: MockReply = {
	status: 200,
	body: { success: true, data: { message: 'Volume workspace updated successfully' } }
};

describe('workspace folders on Arcane v3', () => {
	it('requests one folder level with the path query', async () => {
		const { volumes, projects, requests } = makeServices('v3', () => ({
			status: 200,
			body: { success: true, data: listing }
		}));
		const folder = await volumes.workspace({ envID: '0', name: 'data', path: 'a' });
		await volumes.workspace({ envID: '0', name: 'data' });
		await projects.workspace({ envID: '0', projectID: 'p1', path: 'a/b' });

		expect(folder.files[0]?.relativePath).toBe('a/b');
		expect(folder.fileTreeRevision).toBe('');
		expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
			`GET ${BASE}/api/agents/0/volumes/data/workspace?path=a`,
			`GET ${BASE}/api/agents/0/volumes/data/workspace`,
			`GET ${BASE}/api/agents/0/projects/p1/workspace?path=a/b`
		]);
	});

	it('saves volume files without a revision and accepts a message response', async () => {
		const { volumes, requests } = makeServices('v3', () => messageReply);
		const result = await volumes.updateWorkspace({
			envID: '0',
			name: 'data',
			manifest: {
				fileTreeRevision: '',
				fileChanges: [{ operation: 'delete', relativePath: 'a/b', recursive: true }]
			}
		});

		expect(result).toBeUndefined();
		const request = requests[0]!;
		expect(`${request.method} ${request.url}`).toBe(
			`PATCH ${BASE}/api/agents/0/volumes/data/workspace`
		);
		expect(JSON.parse((request.body as FormData).get('manifest') as string)).toEqual({
			fileChanges: [{ operation: 'delete', relativePath: 'a/b', recursive: true }]
		});
	});

	it('saves project files without a revision', async () => {
		const { projects, requests } = makeServices('v3', () => messageReply);
		const result = await projects.updateWorkspace({
			envID: '0',
			projectID: 'p1',
			fileTreeRevision: '',
			changes: [{ operation: 'create_folder', relativePath: 'conf' }]
		});

		expect(result).toBeUndefined();
		const request = requests[0]!;
		expect(`${request.method} ${request.url}`).toBe(
			`PATCH ${BASE}/api/agents/0/projects/p1/workspace`
		);
		expect(JSON.parse((request.body as FormData).get('manifest') as string)).toEqual({
			fileChanges: [{ operation: 'create_folder', relativePath: 'conf' }]
		});
	});
});

describe('workspace folders on Arcane v2', () => {
	it('keeps the full tree request and sends the revision', async () => {
		const { volumes, requests } = makeServices('legacy', () => ({
			status: 200,
			body: { success: true, data: { ...listing, fileTreeRevision: 'r1' } }
		}));
		await volumes.workspace({ envID: '0', name: 'data' });
		const saved = await volumes.updateWorkspace({
			envID: '0',
			name: 'data',
			manifest: {
				fileTreeRevision: 'r1',
				fileChanges: [{ operation: 'delete', relativePath: 'a/b' }]
			}
		});

		expect(saved?.fileTreeRevision).toBe('r1');
		expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
			`GET ${BASE}/api/environments/0/volumes/data/workspace`,
			`PUT ${BASE}/api/environments/0/volumes/data/workspace`
		]);
		expect(JSON.parse((requests[1]!.body as FormData).get('manifest') as string)).toEqual({
			fileTreeRevision: 'r1',
			fileChanges: [{ operation: 'delete', relativePath: 'a/b' }]
		});
	});
});
