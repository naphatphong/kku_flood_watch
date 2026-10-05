// What a visitor keeps: saved places and their timetable. Stored on the device and, when
// signed in, in their account (newer edit wins).
import type { Building } from './buildings';
import type { LngLat } from './geo';
import type { ClassEntry } from './timetable';

/** A place as saved: a snapshot, so it still works if the building list changes. */
export interface PlaceRef {
  id: string | null; // building id, or null for a point picked on the map
  name: string;
  center: LngLat;
}

export interface UserData {
  saved: PlaceRef[];
  classes: ClassEntry[];
  updatedAt: number; // ms; 0 = never edited
}

export const EMPTY_USER_DATA: UserData = { saved: [], classes: [], updatedAt: 0 };

export const placeRef = (b: Pick<Building, 'id' | 'name' | 'center'>): PlaceRef => ({ id: b.id, name: b.name, center: b.center });

const same = (a: PlaceRef, b: PlaceRef) => (a.id && b.id ? a.id === b.id : a.name === b.name && a.center.join() === b.center.join());

export const isSaved = (saved: PlaceRef[], p: PlaceRef) => saved.some((s) => same(s, p));

/** Saves a place, or removes it when it is already saved. */
export const toggleSaved = (saved: PlaceRef[], p: PlaceRef) => (isSaved(saved, p) ? saved.filter((s) => !same(s, p)) : [...saved, p]);

/** Stored data back to a UserData (old or hand-edited storage must not crash the page). */
export function readUserData(raw: unknown): UserData {
  const d = raw as Partial<UserData> | null;
  return {
    saved: Array.isArray(d?.saved) ? d.saved : [],
    classes: Array.isArray(d?.classes) ? d.classes : [],
    updatedAt: typeof d?.updatedAt === 'number' ? d.updatedAt : 0,
  };
}

/** Device vs account copy: the newer edit wins. */
export const newer = (a: UserData, b: UserData) => (b.updatedAt > a.updatedAt ? b : a);
