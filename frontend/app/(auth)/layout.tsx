'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (initialized && user) {
      router.replace('/chat');
    }
  }, [initialized, user, router]);

  return (
    <div className="relative min-h-screen overflow-hidden gradient-bg">
      <div className="container flex min-h-screen items-center justify-center py-12">
        {children}
      </div>
    </div>
  );
}
