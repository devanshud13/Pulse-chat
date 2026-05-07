'use client';

import { useTheme } from 'next-themes';
import { Bell, Moon, Sun, ShieldCheck } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMounted } from '@/hooks/useMounted';
import { toast } from 'sonner';

export default function SettingsPage(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const requestNotifications = async (): Promise<void> => {
    if (!('Notification' in window)) {
      toast.error('Notifications not supported');
      return;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') toast.success('Browser notifications enabled');
    else toast.error('Permission denied');
  };

  return (
    <PageShell title="Settings" description="Customize your experience.">
      <div className="space-y-4">
        <Card className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            {mounted && theme === 'dark' ? (
              <Moon className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <div className="font-medium">Theme</div>
              <div className="text-xs text-muted-foreground">Choose light or dark mode.</div>
            </div>
          </div>
          {mounted && (
            <Button variant="outline" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              Switch to {theme === 'dark' ? 'light' : 'dark'}
            </Button>
          )}
        </Card>

        <Card className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Browser notifications</div>
              <div className="text-xs text-muted-foreground">
                Get desktop alerts on the website. The Chrome extension also works in the background.
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => void requestNotifications()}>
            Enable
          </Button>
        </Card>

        <Card className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Security</div>
              <div className="text-xs text-muted-foreground">
                Sessions are protected with rotating refresh tokens.
              </div>
            </div>
          </div>
          <Button variant="outline" disabled>
            Active
          </Button>
        </Card>
      </div>
    </PageShell>
  );
}
