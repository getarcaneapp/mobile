import { capitalized } from './compose-field-options';

const acronyms: Record<string, string> = {
	dns: 'DNS',
	url: 'URL',
	urls: 'URLs',
	ip: 'IP',
	ipv4: 'IPv4',
	ipv6: 'IPv6',
	pid: 'PID',
	ipc: 'IPC',
	cpu: 'CPU',
	cpus: 'CPUs',
	io: 'IO',
	mac: 'MAC'
};

export const ComposeDisplayText = {
	title(value: string): string {
		if (value === 'x-arcane') return 'Arcane Metadata';
		return value
			.replace(/_/g, ' ')
			.replace(/-/g, ' ')
			.split(' ')
			.filter((word) => word !== '')
			.map((word) => acronyms[word.toLowerCase()] ?? capitalized(word))
			.join(' ');
	}
};
