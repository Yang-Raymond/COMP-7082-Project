import AsyncStorage from '@react-native-async-storage/async-storage';

export type ProfileDetails = { displayName: string; bio: string };

const EMPTY: ProfileDetails = { displayName: '', bio: '' };
const key = (userId: number) => `profile:details:${userId}`;

export async function getProfileDetails(userId: number): Promise<ProfileDetails> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {}
  return EMPTY;
}

export async function saveProfileDetails(userId: number, details: ProfileDetails): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify(details));
}