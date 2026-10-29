export type ResponseNormalizer = (raw: unknown) => unknown;

type JSONObject = Record<string, unknown>;

function isObject(value: unknown): value is JSONObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const AGENT_FIELD_RENAMES: readonly (readonly [string, string])[] = [
	['agentTransport', 'edgeTransport'],
	['lastAgentTransport', 'lastEdgeTransport'],
	['agentSecurityMode', 'edgeSecurityMode'],
	['agentSessionId', 'edgeSessionId'],
	['agentInstance', 'edgeAgentInstance'],
	['agentCapabilities', 'edgeCapabilities'],
	['agentRoundTripMs', 'edgeRoundTripMs'],
	['agentOpenStreams', 'edgeOpenStreams'],
	['agentMTLSCertificate', 'edgeMTLSCertificate']
];

export function normalizeV3Environment(raw: unknown): unknown {
	if (!isObject(raw) || typeof raw.id !== 'string') return raw;
	if (typeof raw.isEdge === 'boolean') return raw;
	const environment: JSONObject = { ...raw };
	for (const [from, to] of AGENT_FIELD_RENAMES) {
		if (environment[from] !== undefined && environment[to] === undefined) {
			environment[to] = environment[from];
		}
	}
	environment.isEdge = raw.id !== '0';
	return environment;
}

export function normalizeV3Settings(raw: unknown): unknown {
	if (Array.isArray(raw)) return raw;
	if (!isObject(raw)) return raw;
	if (Array.isArray(raw.settings)) return raw.settings;
	if (isObject(raw.data) && Array.isArray(raw.data.settings)) return raw.data.settings;
	return raw;
}

function settingsEnvelope(raw: unknown): unknown {
	if (isObject(raw) && typeof raw.success === 'boolean') return raw;
	const settings = normalizeV3Settings(raw);
	return { success: true, data: Array.isArray(settings) ? settings : [] };
}

function environmentEnvelope(raw: unknown): unknown {
	if (!isObject(raw)) return raw;
	if (Array.isArray(raw.data)) return { ...raw, data: raw.data.map(normalizeV3Environment) };
	if (raw.data !== undefined) return { ...raw, data: normalizeV3Environment(raw.data) };
	return normalizeV3Environment(raw);
}

interface ResponseRule {
	methods: readonly string[];
	pattern: RegExp;
	normalize: ResponseNormalizer;
}

const RESPONSE_RULES: readonly ResponseRule[] = [
	{
		methods: ['GET'],
		pattern: /^environments\/[^/]+\/settings(\/public)?$/,
		normalize: normalizeV3Settings
	},
	{
		methods: ['PUT', 'PATCH'],
		pattern: /^environments\/[^/]+\/settings$/,
		normalize: settingsEnvelope
	},
	{ methods: ['GET', 'POST'], pattern: /^environments$/, normalize: environmentEnvelope },
	{
		methods: ['GET', 'PUT', 'PATCH'],
		pattern: /^environments\/[^/,]+$/,
		normalize: environmentEnvelope
	}
];

export function v3ResponseNormalizer(method: string, path: string): ResponseNormalizer | undefined {
	const upper = method.toUpperCase();
	const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '');
	for (const rule of RESPONSE_RULES) {
		if (rule.methods.includes(upper) && rule.pattern.test(trimmed)) return rule.normalize;
	}
	return undefined;
}
