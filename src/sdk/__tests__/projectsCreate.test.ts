import { describe, expect, it } from 'vite-plus/test';

import { AuthManager } from '../auth/AuthManager';
import { InMemoryTokenStore } from '../auth/TokenStore';
import { ArcaneTransport } from '../client/ArcaneTransport';
import { EnvironmentID, RetryPolicy } from '../client/environment';
import { RESTService } from '../http/RESTService';
import { ProjectFileDraft } from '../models/project/ProjectFiles';
import { ProjectsService } from '../services/ProjectsService';
import { isoIn, mockFetch, type MockReply } from './helpers';
import { APIGenerationState } from '../client/apiGeneration';

const BASE = 'https://arcane.test';

const createdReply: MockReply = {
	status: 200,
	body: {
		success: true,
		data: {
			id: 'p1',
			name: 'demo',
			path: '/app/data/projects/demo',
			status: 'stopped',
			serviceCount: 1,
			runningCount: 0,
			isArchived: false,
			createdAt: '2026-10-17T00:00:00Z',
			updatedAt: '2026-10-17T00:00:00Z'
		}
	}
};

function makeService(handler: Parameters<typeof mockFetch>[0]) {
	const { fetch, requests } = mockFetch(handler);
	const tokenStore = new InMemoryTokenStore({
		accessToken: 'access',
		refreshToken: 'refresh',
		expiresAt: isoIn(3600)
	});
	const authManager = new AuthManager({ baseURL: BASE, tokenStore, fetch });
	const transport = new ArcaneTransport({
		baseURL: BASE,
		apiGeneration: new APIGenerationState('legacy'),
		authManager,
		fetch,
		streamingFetch: fetch,
		retryPolicy: RetryPolicy.default
	});
	const service = new ProjectsService(new RESTService(transport, EnvironmentID.localDocker));
	return { service, requests };
}

describe('ProjectsService.create', () => {
	it('builds project/manifest parts with compose and .env inline', () => {
		const { fields, files } = ProjectsService.createMultipartParts({
			name: 'demo',
			composeContent: 'services: {}\n',
			envContent: 'A=1\n'
		});
		expect(JSON.parse(fields.project)).toEqual({
			name: 'demo',
			composeContent: 'services: {}\n',
			envContent: 'A=1\n'
		});
		expect(JSON.parse(fields.manifest)).toEqual({ fileChanges: [] });
		expect(files).toEqual([]);
	});

	it('maps project file drafts to manifest changes with indexed uploads', () => {
		const { fields, files } = ProjectsService.createMultipartParts({
			name: 'demo',
			composeContent: 'services: {}\n',
			projectFiles: [
				ProjectFileDraft.make({ relativePath: 'config', isDirectory: true }),
				ProjectFileDraft.make({ relativePath: 'config/app.conf', content: 'x=1' }),
				ProjectFileDraft.make({ relativePath: 'README.md', content: '# hi' })
			]
		});
		expect(JSON.parse(fields.project)).toEqual({ name: 'demo', composeContent: 'services: {}\n' });
		expect(JSON.parse(fields.manifest)).toEqual({
			fileChanges: [
				{ operation: 'create_folder', relativePath: 'config' },
				{ operation: 'create_file', relativePath: 'config/app.conf', uploadIndex: 0 },
				{ operation: 'create_file', relativePath: 'README.md', uploadIndex: 1 }
			]
		});
		expect(files.map((file) => [file.fieldName, file.filename])).toEqual([
			['files', 'app.conf'],
			['files', 'README.md']
		]);
		expect(files[0]?.text).toBe('x=1');
	});

	it('POSTs multipart/form-data to the projects endpoint and decodes the response', async () => {
		const { service, requests } = makeService(() => createdReply);
		const created = await service.create({
			request: { name: 'demo', composeContent: 'services: {}\n', envContent: '' }
		});

		expect(created.id).toBe('p1');
		expect(requests).toHaveLength(1);
		const request = requests[0]!;
		expect(request.method).toBe('POST');
		expect(request.url).toBe(`${BASE}/api/environments/0/projects`);
		expect(request.body).toBeInstanceOf(FormData);
		const form = request.body as FormData;
		expect(JSON.parse(form.get('project') as string)).toEqual({
			name: 'demo',
			composeContent: 'services: {}\n',
			envContent: ''
		});
		expect(JSON.parse(form.get('manifest') as string)).toEqual({ fileChanges: [] });
		expect(form.getAll('files')).toEqual([]);
		const contentType = Object.entries(request.headers).find(
			([name]) => name.toLowerCase() === 'content-type'
		);
		expect(contentType).toBeUndefined();
	});

	it('falls back to the JSON body when a pre-2.8 server rejects multipart (415)', async () => {
		const { service, requests } = makeService((request) =>
			request.body instanceof FormData
				? { status: 415, body: { title: 'Unsupported Media Type', status: 415, detail: 'x' } }
				: createdReply
		);
		await service.create({ request: { name: 'demo', composeContent: 'services: {}\n' } });

		expect(requests).toHaveLength(2);
		expect(requests[1]?.body).toEqual({ name: 'demo', composeContent: 'services: {}\n' });
	});
});
