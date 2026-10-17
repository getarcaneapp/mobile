/** `JobScheduleConfigView`'s section footer. */
export function scheduleFooter(environmentName: string | undefined): string {
	return environmentName !== undefined
		? `Cron expressions accept 5- or 6-field syntax. Changes save to ${environmentName}'s settings.`
		: "Cron expressions accept 5- or 6-field syntax. Changes save to the active environment's settings.";
}
