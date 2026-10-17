/**
 * Port of `ComposeFieldOptions` (Types/ComposeFieldOptions.swift): presentation
 * choices that supplement fields whose schema describes, but does not
 * enumerate, common values.
 */
import { isKey, type ComposeFieldPath } from './compose-native-field';
import { ComposeSchema } from './compose-schema';

type Entry = { path: string[]; values: string[]; custom: boolean };
const entry = (path: string, values: string[], custom = false): Entry => ({
	path: path.split('/'),
	values,
	custom
});

// Linux capability names, including Docker's ALL shorthand.
const capabilities = [
	'ALL',
	'AUDIT_CONTROL',
	'AUDIT_READ',
	'AUDIT_WRITE',
	'BLOCK_SUSPEND',
	'BPF',
	'CHECKPOINT_RESTORE',
	'CHOWN',
	'DAC_OVERRIDE',
	'DAC_READ_SEARCH',
	'FOWNER',
	'FSETID',
	'IPC_LOCK',
	'IPC_OWNER',
	'KILL',
	'LEASE',
	'LINUX_IMMUTABLE',
	'MAC_ADMIN',
	'MAC_OVERRIDE',
	'MKNOD',
	'NET_ADMIN',
	'NET_BIND_SERVICE',
	'NET_BROADCAST',
	'NET_RAW',
	'PERFMON',
	'SETFCAP',
	'SETGID',
	'SETPCAP',
	'SETUID',
	'SYS_ADMIN',
	'SYS_BOOT',
	'SYS_CHROOT',
	'SYS_MODULE',
	'SYS_NICE',
	'SYS_PACCT',
	'SYS_PTRACE',
	'SYS_RAWIO',
	'SYS_RESOURCE',
	'SYS_TIME',
	'SYS_TTY_CONFIG',
	'SYSLOG',
	'WAKE_ALARM'
];
const signals = [
	'SIGTERM',
	'SIGINT',
	'SIGHUP',
	'SIGQUIT',
	'SIGKILL',
	'SIGUSR1',
	'SIGUSR2',
	'SIGABRT',
	'SIGALRM',
	'SIGBUS',
	'SIGCHLD',
	'SIGCLD',
	'SIGCONT',
	'SIGFPE',
	'SIGILL',
	'SIGIO',
	'SIGIOT',
	'SIGPIPE',
	'SIGPOLL',
	'SIGPROF',
	'SIGPWR',
	'SIGSEGV',
	'SIGSTKFLT',
	'SIGSTOP',
	'SIGSYS',
	'SIGTRAP',
	'SIGTSTP',
	'SIGTTIN',
	'SIGTTOU',
	'SIGURG',
	'SIGVTALRM',
	'SIGWINCH',
	'SIGXCPU',
	'SIGXFSZ',
	'SIGRTMIN',
	'SIGRTMAX',
	...Array.from({ length: 15 }, (_, i) => `SIGRTMIN+${i + 1}`),
	...Array.from({ length: 14 }, (_, i) => `SIGRTMAX-${i + 1}`)
];

/** `TimeZone.knownTimeZoneIdentifiers`. */
function timeZones(): string[] {
	try {
		const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
			.supportedValuesOf;
		if (supported) return supported('timeZone');
	} catch {
		// Older engines; fall through.
	}
	return ['UTC'];
}

// Closed choices supplement omissions in compose-spec.json. Extensible drivers and
// parameterized policies retain a custom entry. Paths never match dictionary contents.
const catalog: Entry[] = (() => {
	const result: Entry[] = [];
	for (const root of ['services', 'jobs']) {
		const p = root + '/*/';
		result.push(
			entry(p + 'cap_add/[]', capabilities),
			entry(p + 'cap_drop/[]', capabilities),
			entry(p + 'stop_signal', signals, true),
			entry(p + 'restart', ['no', 'always', 'on-failure', 'unless-stopped'], true),
			entry(
				p + 'pull_policy',
				['missing', 'always', 'never', 'build', 'if_not_present', 'refresh', 'daily', 'weekly'],
				true
			),
			entry(p + 'isolation', ['default', 'process', 'hyperv']),
			entry(p + 'build/isolation', ['default', 'process', 'hyperv']),
			entry(p + 'deploy/mode', ['replicated', 'global', 'replicated-job', 'global-job']),
			entry(p + 'deploy/endpoint_mode', ['vip', 'dnsrr']),
			entry(p + 'deploy/restart_policy/condition', ['none', 'on-failure', 'any']),
			entry(p + 'deploy/update_config/failure_action', ['continue', 'pause', 'rollback']),
			entry(p + 'deploy/rollback_config/failure_action', ['continue', 'pause']),
			entry(p + 'ports/[]/protocol', ['tcp', 'udp']),
			entry(p + 'ports/[]/mode', ['host', 'ingress']),
			entry(p + 'volumes/[]/bind/propagation', [
				'private',
				'rprivate',
				'shared',
				'rshared',
				'slave',
				'rslave'
			]),
			entry(p + 'volumes/[]/consistency', ['consistent', 'cached', 'delegated']),
			entry(p + 'devices/[]/permissions', ['rwm', 'r', 'w', 'm', 'rw', 'rm', 'wm']),
			entry(p + 'env_file/[]/format', ['raw']),
			entry(p + 'network_mode', ['bridge', 'host', 'none'], true),
			entry(p + 'ipc', ['private', 'shareable', 'host', 'none'], true),
			entry(p + 'pid', ['host'], true),
			entry(p + 'uts', ['host']),
			entry(p + 'userns_mode', ['host']),
			entry(p + 'build/network', ['default', 'none', 'host'], true),
			entry(
				p + 'logging/driver',
				[
					'local',
					'json-file',
					'syslog',
					'journald',
					'gelf',
					'fluentd',
					'awslogs',
					'splunk',
					'etwlogs',
					'gcplogs',
					'none'
				],
				true
			)
		);
	}
	result.push({
		path: 'jobs/*/triggers/schedule/[]/timezone'.split('/'),
		get values() {
			return timeZones();
		},
		custom: true
	} as Entry);
	result.push(
		entry('networks/*/driver', ['bridge', 'host', 'overlay', 'ipvlan', 'macvlan', 'none'], true)
	);
	return result;
})();

/** Swift `String.capitalized`. */
export function capitalized(value: string): string {
	return value.replace(
		/[^\s]+/g,
		(word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
	);
}

export class ComposeFieldOptions {
	readonly values: string[];
	readonly allowsCustom: boolean;

	constructor(path: ComposeFieldPath) {
		const schema = ComposeSchema.value(path);
		const choices = schema?.enumValues ?? [];
		if (choices.length > 0) {
			this.values = choices;
			this.allowsCustom = false;
			return;
		}
		const first = path[0];
		const suffix = path.slice(-3);
		if (
			path.length === 5 &&
			isKey(first) &&
			['services', 'jobs'].includes(first.key) &&
			isKey(suffix[0]) &&
			suffix[0].key === 'healthcheck' &&
			isKey(suffix[1]) &&
			suffix[1].key === 'test' &&
			suffix[2] !== undefined &&
			!isKey(suffix[2]) &&
			suffix[2].index === 0
		) {
			this.values = ['CMD', 'CMD-SHELL', 'NONE'];
			this.allowsCustom = false;
			return;
		}
		const keys = path.map((component) => (isKey(component) ? component.key : '[]'));
		const match = catalog.find(
			(candidate) =>
				candidate.path.length === keys.length &&
				candidate.path.every((part, i) => part === '*' || part === keys[i])
		);
		this.values = match?.values ?? [];
		this.allowsCustom = match?.custom ?? true;
	}

	label(value: string): string {
		if (capabilities.includes(value) || value.startsWith('SIG') || value.includes('/'))
			return value;
		switch (value) {
			case 'CMD':
				return 'Run command';
			case 'CMD-SHELL':
				return 'Run in shell';
			case 'NONE':
				return 'Disable health check';
			case 'z':
				return 'Shared SELinux label';
			case 'Z':
				return 'Private SELinux label';
			case 'bind':
				return 'Host folder';
			case 'volume':
				return 'Docker volume';
			case 'tmpfs':
				return 'Temporary memory storage';
			case 'tcp':
				return 'TCP';
			case 'udp':
				return 'UDP';
			case 'vip':
				return 'Virtual IP';
			case 'dnsrr':
				return 'DNS round-robin';
			case 'no':
				return 'Never';
			case 'on-failure':
				return 'On failure';
			case 'unless-stopped':
				return 'Unless stopped manually';
			case 'missing':
				return 'Only when missing';
			case 'service_started':
				return 'Service has started';
			case 'service_healthy':
				return 'Health check passes';
			case 'service_completed_successfully':
				return 'Service finishes successfully';
			default:
				return capitalized(value.replace(/_/g, ' ').replace(/-/g, ' '));
		}
	}
}
