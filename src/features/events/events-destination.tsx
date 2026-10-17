import { EventsScreen } from './events-screen';

/** `appTabDestination(.events)`: events are global; the store resets itself when the client changes. */
export function EventsDestination() {
	return <EventsScreen />;
}
