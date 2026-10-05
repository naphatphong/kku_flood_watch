'use client';

import { useSyncExternalStore } from 'react';
import { EMPTY_USER_DATA, readUserData, type UserData } from '@/lib/domain/user-data';

// One shared copy per tab, saved to localStorage on every edit.
const KEY = 'kfw-user-data';
let state: UserData = EMPTY_USER_DATA;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    state = readUserData(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    // private mode or broken storage: start empty
  }
}

/** Replaces the data (used by edits and by account sync) and tells every subscriber. */
export function setUserData(next: UserData) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // not remembered on this device
  }
  listeners.forEach((l) => l());
}

/** Edits the data; the edit time decides which copy wins when syncing. */
export const updateUserData = (edit: (d: UserData) => Omit<UserData, 'updatedAt'>) => {
  load();
  setUserData({ ...edit(state), updatedAt: Date.now() });
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Saved places and timetable. Empty during server render, then this device's copy. */
export function useUserData(): UserData {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => EMPTY_USER_DATA,
  );
}
