export function titleCasedWords(value: string): string {
	return value
		.split(/[\s_.-]+/)
		.filter((word) => word !== '')
		.map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase())
		.join(' ');
}
