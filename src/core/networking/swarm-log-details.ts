const swarmDetailsPrefix = /^(?:com\.docker\.swarm\.[a-z_.]+=[^,\s]*,?)+\s?/;

export function withoutSwarmLogDetails(text: string): string {
	return text.replace(swarmDetailsPrefix, '');
}
