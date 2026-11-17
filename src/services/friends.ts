import { authedApi } from '../auth/auth';

export interface Friend {
  id: string;
  name: string;
  username: string;
  /** Their challenges don't notify you. */
  muted?: boolean;
}

export interface FriendRequest {
  id: string;
  username: string;
}

/** Someone you could send a friend request to. `mutual` = friends you have in common. */
export interface Suggestion {
  id: string;
  username: string;
  mutual: number;
}

/** A saved route as the friends endpoints list it (no GPS path; fetch that when the route is opened). */
export interface SharedRoute {
  id: number;
  name: string;
  activity: 'run' | 'bike';
  visibility: 'public' | 'private';
  distance_m: number;
  elevation_gain_m: number | null;
  created_at: string;
  creator: string;
  /** Only on feed results. */
  by_friend?: boolean;
}

// Friends and requests. Actions with no data send {} because authedApi only uses POST when given a body.
export const getFriends = () => authedApi<Friend[]>('/friends');
export const getRequests = () => authedApi<FriendRequest[]>('/friends/requests');
export const getSuggestions = () => authedApi<Suggestion[]>('/friends/suggestions');
export const sendRequest = (username: string) => authedApi('/friends/requests', { username });
export const acceptRequest = (id: string) => authedApi(`/friends/requests/${id}/accept`, {});
export const declineRequest = (id: string) => authedApi(`/friends/requests/${id}/decline`, {});
export const removeFriend = (id: string) => authedApi(`/friends/${id}/remove`, {});
export const setMuted = (id: string, muted: boolean) => authedApi(`/friends/${id}/mute`, { muted });

// Routes shared through friendships
export const getFriendRoutes = (friendId: string, activity?: 'run' | 'bike') =>
  authedApi<SharedRoute[]>(`/friends/${friendId}/routes${activity ? `?activity=${activity}` : ''}`);

/** scope: 'public' = everyone's public routes, 'friends' = all of my friends' routes, 'all' = both. */
export const getFeed = (scope: 'public' | 'friends' | 'all' = 'public', activity?: 'run' | 'bike') =>
  authedApi<SharedRoute[]>(`/friends/feed?scope=${scope}${activity ? `&activity=${activity}` : ''}`);

/** The server appends "[http://host/path]" to error messages; hide that from users. */
export const cleanError = (e: unknown, fallback = 'Something went wrong.') =>
  String((e as any)?.message ?? fallback).replace(/\s*\[https?:\/\/[^\]]*\]$/, '');