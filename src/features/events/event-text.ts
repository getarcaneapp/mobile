export const readableEventText = (value: string) =>
	value.replace(/\b([0-9a-f]{12})[0-9a-f]{52}\b/g, '$1…');

export const eventRedundantDescription = (event: { title: string; description?: string }) =>
	!event.description ||
	readableEventText(event.description).toLowerCase() ===
		readableEventText(event.title).toLowerCase();
