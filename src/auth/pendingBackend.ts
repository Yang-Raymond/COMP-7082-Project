// Backend calls the new designs need that don't exist yet.
// Each one fails on purpose until you replace it, and the screens handle that gracefully.

/** TODO(backend): Google OAuth. Exchange the Google token for a session; create the account if it's new. */
export async function signInWithGoogle(): Promise<void> {
  throw new Error('Google sign-in is not available yet.');
}

/** TODO(backend): returns true if the username is free (case-insensitive). The "Available" badge appears once this works. */
export async function checkUsernameAvailable(_username: string): Promise<boolean> {
  throw new Error('Username check not implemented.');
}