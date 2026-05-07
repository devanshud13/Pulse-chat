import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Pulse — Realtime Chat',
  description:
    'Modern, secure, realtime team chat with groups, file sharing, and a Chrome notification extension.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <div className="relative flex min-h-screen flex-col">{children}</div>
              <Toaster richColors position="top-right" theme="system" closeButton />
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
