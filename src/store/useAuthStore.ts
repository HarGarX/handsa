import { create } from 'zustand';

// Deliberately separate from `usePlanStore`: authentication state and plan
// data are two unrelated concerns. Login/register never contact a network —
// there's nothing to send a display name to — so this store is the entire
// "backend." Logging out only clears this key; it can never touch a user's
// saved plans, because plans were never tied to an account in the first
// place. See the README's Phase 6 section for the full rationale.

const AUTH_KEY = 'blueprint.auth';

interface StoredAuth {
  isAuthed: boolean;
  displayName: string | null;
}

function loadStoredAuth(): StoredAuth {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { isAuthed: false, displayName: null };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return { isAuthed: false, displayName: null };
    const p = parsed as Record<string, unknown>;
    return {
      isAuthed: typeof p.isAuthed === 'boolean' ? p.isAuthed : false,
      displayName: typeof p.displayName === 'string' ? p.displayName : null,
    };
  } catch {
    return { isAuthed: false, displayName: null };
  }
}

function persist(state: StoredAuth): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
}

interface AuthStore {
  isAuthed: boolean;
  /** Set for both a real (fake) login and a guest session, so the TopBar has a name to show either way. */
  displayName: string | null;
  isGuest: boolean;
  login: (displayName: string) => void;
  continueAsGuest: () => void;
  logout: () => void;
}

const initial = loadStoredAuth();

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthed: initial.isAuthed,
  displayName: initial.displayName,
  isGuest: !initial.isAuthed && initial.displayName !== null,

  login: (displayName) => {
    const trimmed = displayName.trim();
    const next = { isAuthed: true, displayName: trimmed || 'Friend' };
    persist(next);
    set({ ...next, isGuest: false });
  },

  continueAsGuest: () => {
    const next = { isAuthed: false, displayName: 'Guest' };
    persist(next);
    set({ ...next, isGuest: true });
  },

  logout: () => {
    const next = { isAuthed: false, displayName: null };
    persist(next);
    set({ ...next, isGuest: false });
  },
}));
