import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="relative min-h-screen overflow-hidden gradient-bg">
      <div className="container flex min-h-screen items-center justify-center py-12">
        {children}
      </div>
    </div>
  );
}
