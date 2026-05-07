'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { notificationService } from '@/services/notification.service';
import type { NotificationItem } from '@/types';
import { formatRelative } from '@/utils/format';

export default function NotificationsPage(): JSX.Element {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await notificationService.list();
        if (active) setItems(list);
      } catch {
        toast.error('Failed to load');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const markAll = async (): Promise<void> => {
    try {
      await notificationService.markAllRead();
      setItems((cur) => cur.map((n) => ({ ...n, read: true })));
      toast.success('All marked as read');
    } catch {
      toast.error('Failed');
    }
  };

  const open = async (n: NotificationItem): Promise<void> => {
    try {
      await notificationService.markRead(n._id);
    } catch {
      /* ignore */
    }
    if (n.chat) router.push(`/chat/${n.chat}`);
  };

  return (
    <PageShell title="Notifications" description="Activity from your conversations.">
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void markAll()}>
          Mark all as read
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          You're all caught up.
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n._id}
              onClick={() => void open(n)}
              className="block w-full text-left"
            >
              <Card
                className={
                  'p-4 transition-colors hover:border-primary/40 ' +
                  (n.read ? 'opacity-70' : '')
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{n.title}</span>
                      {!n.read && <Badge className="h-5 px-1.5 text-[10px]">new</Badge>}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(n.createdAt)}
                  </span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </PageShell>
  );
}
