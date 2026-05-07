'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/store/auth.store';

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const hydrate = useAuthStore((s) => s.hydrate);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (!initialized) {
      void hydrate();
    }
  }, [initialized, hydrate]);

  return <>{children}</>;
}
