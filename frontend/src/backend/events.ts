import { Events } from '@wailsio/runtime';

export interface Notification {
  level?: string;
  message?: string;
}

export function onNotification(handler: (payload: Notification) => void): () => void {
  return Events.On('snowy:notification', (event) => handler(event.data));
}
