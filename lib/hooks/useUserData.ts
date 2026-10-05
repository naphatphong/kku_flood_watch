'use client';

import { useSyncExternalStore } from 'react';
import { EMPTY_USER_DATA, newer, readUserData, type UserData } from '@/lib/domain/user-data';
import { createClient } from '@/lib/supabase/browser';
import { isSupabaseConfigured } from '@/lib/supabase/env';

// One shared copy per tab, saved to localStorage on every edit and, when signed in, to the
// account (table user_data). Device and account copies merge by edit time: the newer wins.
// ponytail: whole-document last-write-wins; merge per item if people edit on two devices at once.
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
  if (isSupabaseConfigured) startSync();
}

const SYNC_DELAY_MS = 1500;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let userId: string | null = null;

/** Pulls the account copy on sign-in, then pushes edits (debounced). */
function startSync() {
  const db = createClient();
  const pull = async (id: string | null) => {
    userId = id;
    if (!id) return;
    const { data } = await db.from('user_data').select('data, updated_at').eq('user_id', id).maybeSingle();
    const remote = data ? readUserData({ ...data.data, updatedAt: Date.parse(data.updated_at) }) : EMPTY_USER_DATA;
    const best = newer(state, remote);
    if (best === remote && remote.updatedAt) setUserData(remote, false);
    else if (state.updatedAt) push();
  };
  db.auth.getSession().then(({ data }) => pull(data.session?.user.id ?? null));
  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') pull(session?.user.id ?? null);
  });
  const push = () => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (!userId) return;
      const { saved, classes, updatedAt } = state;
      db.from('user_data')
        .upsert({ user_id: userId, data: { saved, classes }, updated_at: new Date(updatedAt).toISOString() })
        .then(({ error }) => error && console.error('user data sync', error.message));
    }, SYNC_DELAY_MS);
  };
  pushEdit = push;
}
let pushEdit = () => {};

/** Replaces the data (edits, account sync) and tells every subscriber; edits also go to the account. */
function setUserData(next: UserData, fromEdit = true) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // not remembered on this device
  }
  listeners.forEach((l) => l());
  if (fromEdit) pushEdit();
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
