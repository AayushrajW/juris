"use client";

import { authService } from "@/services";
import type { User } from "@/domain/user";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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

  const refresh = useCallback(async () => {
    const session = await authService.getSession();
    setUser(session);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void authService.getSession().then((session) => {
      if (cancelled) return;
      setUser(session);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ user, ready, refresh }), [user, ready, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
