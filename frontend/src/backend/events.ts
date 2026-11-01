import { EventsOff, EventsOn } from '../../wailsjs/runtime/runtime';

export interface Notification {
  level?: string;
  message?: string;
}

export function onNotification(handler: (payload: Notification) => void): () => void {
  EventsOn('snowy:notification', handler);
  return () => EventsOff('snowy:notification');
}
