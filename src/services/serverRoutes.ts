import { authedApi } from '../auth/auth';

/** Archives one of your uploaded routes on the server. The server only allows the route's creator to do this. */
export const archiveRoute = (serverId: string) => authedApi(`/routes/${serverId}/delete`, {});