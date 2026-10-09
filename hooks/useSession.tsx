"use client";

import { authService } from "@/services";
import type { User } from "@/domain/user";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

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

  const refresh = async () => {
    const session = await authService.getSession();
    setUser(session);
    setReady(true);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(() => ({ user, ready, refresh }), [user, ready]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
