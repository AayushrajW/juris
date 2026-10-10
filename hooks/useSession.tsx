"use client";

import type { ServiceError } from "@/domain/result";
import type { User } from "@/domain/user";
import { onSessionEnded } from "@/lib/sessionEvents";
import { authService } from "@/services";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface SessionValue {
  user: User | null;
  /** False until the session has been looked up once. */
  ready: boolean;
  /**
   * Set when the session could not be checked (the connection dropped, say).
   * That is not the same as nobody being signed in, so nobody is sent away.
   */
  error: ServiceError | null;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue>({
  user: null,
  ready: false,
  error: null,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  // True from the moment a service says the session is over until someone signs in again.
  const ended = useRef(false);

  const refresh = useCallback(async () => {
    const session = await authService.getSession();
    ended.current = false;
    if (session.ok) setUser(session.data);
    setError(session.ok ? null : session.error);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void authService.getSession().then((session) => {
      // An answer that arrives after the session was reported over is out of date.
      if (cancelled || ended.current) return;
      if (session.ok) setUser(session.data);
      setError(session.ok ? null : session.error);
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
          setError(null);
          setReady(true);
        });
      }),
    [],
  );

  const value = useMemo(() => ({ user, ready, error, refresh }), [user, ready, error, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
