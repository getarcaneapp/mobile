/** Port of Models/System/DockerInfo.swift. */
import { JSONValue, type JSONObject } from '../../types/json';
import { D } from '../base/decoding';

/**
 * Docker daemon version + system info as returned by `/system/docker/info`.
 *
 * The fields below the top-level metadata mirror the Docker SDK's
 * `system.Info` struct, which the Go API embeds verbatim. They are exposed as
 * the `info` dictionary; use the typed top-level fields for the values Arcane
 * massages itself.
 */
export interface DockerInfo {
	success: boolean;
	apiVersion: string;
	gitCommit: string;
	goVersion: string;
	os: string;
	arch: string;
	buildTime: string;
	/**
	 * Raw Docker SDK info payload. Undefined when the API did not embed the
	 * info document (older deployments) — generally populated.
	 */
	info?: Record<string, JSONValue>;
}

const topLevelKeys: ReadonlySet<string> = new Set([
	'success',
	'apiVersion',
	'gitCommit',
	'goVersion',
	'os',
	'arch',
	'buildTime'
]);

export const DockerInfo = {
	make(
		this: void,
		args: {
			success: boolean;
			apiVersion: string;
			gitCommit: string;
			goVersion: string;
			os: string;
			arch: string;
			buildTime: string;
			info?: Record<string, JSONValue>;
		}
	): DockerInfo {
		return { ...args };
	},

	/** Convenience access to commonly-used fields embedded from `system.Info`. */
	ncpu(this: void, value: DockerInfo): number | undefined {
		return JSONValue.intValue(value.info?.['NCPU']);
	},
	memTotal(this: void, value: DockerInfo): number | undefined {
		return JSONValue.int64Value(value.info?.['MemTotal']);
	},
	name(this: void, value: DockerInfo): string | undefined {
		return JSONValue.stringValue(value.info?.['Name']);
	},
	serverVersion(this: void, value: DockerInfo): string | undefined {
		return JSONValue.stringValue(value.info?.['ServerVersion']);
	},
	operatingSystem(this: void, value: DockerInfo): string | undefined {
		return JSONValue.stringValue(value.info?.['OperatingSystem']);
	},

	/**
	 * Swift `init(from:)`: decodes the whole payload as a JSON object, pulling
	 * the top-level fields and moving every other key into `info`.
	 */
	decode(this: void, raw: unknown): DockerInfo {
		const o = D.object(raw, 'DockerInfo') as JSONObject;
		const string = (key: string) => JSONValue.stringValue(o[key]) ?? '';
		const bool = (key: string) => JSONValue.boolValue(o[key]) ?? false;
		const info: Record<string, JSONValue> = {};
		for (const [key, value] of Object.entries(o)) {
			if (!topLevelKeys.has(key) && value !== undefined) info[key] = value;
		}
		return {
			success: bool('success'),
			apiVersion: string('apiVersion'),
			gitCommit: string('gitCommit'),
			goVersion: string('goVersion'),
			os: string('os'),
			arch: string('arch'),
			buildTime: string('buildTime'),
			info: Object.keys(info).length === 0 ? undefined : info
		};
	},

	/** Swift `encode(to:)`: flattens `info` back alongside the top-level fields. */
	encode(this: void, value: DockerInfo): Record<string, JSONValue> {
		const raw: Record<string, JSONValue> = {
			success: value.success,
			apiVersion: value.apiVersion,
			gitCommit: value.gitCommit,
			goVersion: value.goVersion,
			os: value.os,
			arch: value.arch,
			buildTime: value.buildTime
		};
		for (const [key, item] of Object.entries(value.info ?? {})) {
			if (!topLevelKeys.has(key)) raw[key] = item;
		}
		return raw;
	}
} as const;
