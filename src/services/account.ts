import { authedApi, AuthUser, updateSessionUser } from '../auth/auth';

/** Throws with the server's message if the username is taken or invalid. */
export async function changeUsername(username: string): Promise<AuthUser> {
  const { user } = await authedApi<{ user: AuthUser }>('/account/username', { username: username.trim() });
  await updateSessionUser(user);
  return user;
}