// The signed-in user's profile photo. It stays on this phone: the server doesn't store photos yet.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { readJSON, writeJSON } from './storage';

const key = (userId: number) => `ghost-racer:profile-photo:${userId}`;

// iOS can move the app's folder when the app is reinstalled or rebuilt, so only the file name is
// stored and the full path is worked out again each time
const folder = () => new Directory(Paths.document, 'profile-photos');

// The last photo URI seen for each user. Lets the You tab draw the photo straight away each time it
// opens, and is the only place a web photo is kept (until the page reloads).
const known = new Map<number, string | null>();

// An app built before the picker was added has no native code for it, and loading the picker's
// JavaScript then is a fatal error that try/catch can't stop. So check this first, and load the
// picker with import() inside the functions instead of at the top, so those builds still start.
const pickerAvailable = () => Platform.OS === 'web' || requireOptionalNativeModule('ExponentImagePicker') != null;

/** The photo URI last seen for this user, without waiting for storage. Null if none is known yet. */
export function peekProfilePhoto(userId: number): string | null {
  return known.get(userId) ?? null;
}

/** This user's saved photo, or null if there isn't one or its file has gone. */
export async function getProfilePhoto(userId: number): Promise<string | null> {
  if (Platform.OS === 'web') return peekProfilePhoto(userId);
  const name = await readJSON<string>(key(userId));
  const file = name ? new File(folder(), name) : null;
  const uri = file?.exists ? file.uri : null;
  known.set(userId, uri);
  return uri;
}

/**
 * Opens the photo library with a square crop and keeps the chosen photo for this user.
 * Resolves to the photo's URI, or null if the user cancelled. Throws an Error with a message
 * that can be shown to the user if the picker can't open or the photo can't be saved.
 */
export async function pickProfilePhoto(userId: number): Promise<string | null> {
  if (!pickerAvailable()) {
    throw new Error("This build of the app can't pick photos yet. Run npm install, then rebuild it (npx expo run:ios or run:android).");
  }

  let picked: string;
  try {
    const ImagePicker = await import('expo-image-picker');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets[0]) return null;
    picked = res.assets[0].uri;
  } catch (e) {
    console.warn('Photo picker failed:', e);
    throw new Error("Couldn't get that photo. Try again or choose a different one.");
  }
  return savePicked(userId, picked);
}

/**
 * Android only. If Android closed the app while the photo library was open, the picker keeps the
 * chosen photo until it's asked for. Saves it like a normal pick and resolves to its URI, or null.
 */
export async function recoverPickedPhoto(userId: number): Promise<string | null> {
  if (Platform.OS !== 'android' || !pickerAvailable()) return null;
  const ImagePicker = await import('expo-image-picker');
  const res = await ImagePicker.getPendingResultAsync();
  if (!res || 'code' in res || res.canceled || !res.assets[0]) return null;
  return savePicked(userId, res.assets[0].uri);
}

/** Forgets this user's photo and deletes its file. */
export async function removeProfilePhoto(userId: number): Promise<void> {
  known.set(userId, null);
  if (Platform.OS === 'web') return;
  const name = await readJSON<string>(key(userId));
  await writeJSON(key(userId), null);
  if (name) deleteQuietly(new File(folder(), name));
}

// Copies the picker's file into documents (the picker leaves it in a cache folder the system may empty)
async function savePicked(userId: number, picked: string): Promise<string> {
  // Web can't keep files, so there the photo lasts until the page is reloaded
  if (Platform.OS === 'web') {
    known.set(userId, picked);
    return picked;
  }

  let copied: File | null = null;
  try {
    const dir = folder();
    dir.create({ intermediates: true, idempotent: true });
    // A new name each time, so <Image> can't show the previous photo from its cache
    const ext = /\.(jpe?g|png|heic|webp)$/i.exec(picked)?.[1].toLowerCase() ?? 'jpg';
    const name = `${userId}-${Date.now()}.${ext}`;
    const old = await readJSON<string>(key(userId));
    const saved = new File(dir, name);
    await new File(picked).copy(saved);
    copied = saved;
    await writeJSON(key(userId), name);
    if (old && old !== name) deleteQuietly(new File(dir, old));
    known.set(userId, saved.uri);
    return saved.uri;
  } catch (e) {
    console.warn('Saving the profile photo failed:', e);
    // The old photo stays, so drop the new copy. Only one this call made: a failed copy may have
    // hit a file that was already there.
    if (copied) deleteQuietly(copied);
    throw new Error("Couldn't save your photo. Try again.");
  }
}

// A leftover file only wastes a little space, so a failed delete isn't worth an error
function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('Deleting an old profile photo failed:', e);
  }
}
