import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';

// Claiming the shared dock stops the other provider before any new audio starts.
const PlaybackFocus = createContext({claim: (_stop: () => void) => {}, release: (_stop: () => void) => {}});
export function PlaybackFocusProvider({children}: {children: ReactNode}) {
  const active = useRef<(() => void) | null>(null);
  const value = useMemo(() => ({
    claim(stop: () => void) { if (active.current !== stop) active.current?.(); active.current = stop; },
    release(stop: () => void) { if (active.current === stop) active.current = null; },
  }), []);
  return <PlaybackFocus.Provider value={value}>{children}</PlaybackFocus.Provider>;
}
export const usePlaybackFocus = () => useContext(PlaybackFocus);
