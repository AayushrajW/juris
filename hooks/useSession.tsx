"use client";

import { onSessionEnded } from "@/lib/sessionEvents";
import { authService } from "@/services";
import type { User } from "@/domain/user";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface SessionValue {
  user: User | null;
  ready: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue>({
  user: null,
  ready: false,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  // True from the moment a service says the session is over until someone signs in again.
  const ended = useRef(false);

  const refresh = useCallback(async () => {
    const session = await authService.getSession();
    ended.current = false;
    setUser(session);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void authService.getSession().then((session) => {
      // An answer that arrives after the session was reported over is out of date.
      if (cancelled || ended.current) return;
      setUser(session);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A service said the session is over: it ran out, or the person signed out
  // in another tab. Finish the job here (so the cookie that lets pages open is
  // gone too), and only then drop the user, which sends the person to sign in.
  useEffect(
    () =>
      onSessionEnded(() => {
        if (ended.current) return;
        ended.current = true;
        void authService.signOut().finally(() => {
          setUser(null);
          setReady(true);
        });
      }),
    [],
  );

  const value = useMemo(() => ({ user, ready, refresh }), [user, ready, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
