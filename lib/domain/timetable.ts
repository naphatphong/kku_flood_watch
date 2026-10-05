// Class timetable (owner request, 5 Oct 2026): entered by hand or pasted from the registrar.
import type { PlaceRef } from './user-data';

export interface ClassEntry {
  id: string;
  course: string; // e.g. "SC313002"
  title: string | null;
  day: number; // 0 = Sunday … 6 = Saturday
  start: string; // "HH:MM"
  end: string;
  place: PlaceRef;
  room: string | null;
}
