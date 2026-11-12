// The app's route uploader, wired to the real storage, server address and signed-in account.
// AppShell keeps the account up to date with setUploadAccount and calls uploadPendingRoutes() when someone
// signs in and when the app comes back to the foreground; RecordScreen calls it after "Save & Challenge".
import type { Session } from '../auth/auth';
import { createRouteUploader, type UploadAccount } from './routeUpload';
import { getRoutes, updateRoute } from './storage';

let account: UploadAccount | null = null;

/** Called by AppShell whenever someone signs in or out, so uploads use the right account. */
export function setUploadAccount(session: Session | null): void {
  account = session ? { token: session.token, userId: session.user.id } : null;
}

const uploader = createRouteUploader({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  getAccount: () => account,
  getRoutes,
  updateRoute,
  fetch: (input, init) => fetch(input, init),
});

const listeners = new Set<() => void>();

/** Calls `onChange` after every upload pass, so an open screen can show the new upload states. Returns an unsubscribe. */
export function onUploadsChanged(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function uploadPendingRoutes() {
  return uploader().finally(() => listeners.forEach((l) => l()));
}
