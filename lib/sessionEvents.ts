/*
 * A session can end while a page is open: it runs out, or the person signs out
 * in another tab. The first service call after that comes back
 * "unauthenticated". This carries that news from the service layer to the
 * session provider, which sends the person to sign in again.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onSessionEnded(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportSessionEnded() {
  for (const listener of listeners) listener();
}
