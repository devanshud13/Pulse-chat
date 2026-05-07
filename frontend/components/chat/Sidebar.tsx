'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Bell, LogOut, MessageCircle, Moon, Plus, Search, Settings, Sun, User as UserIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import type { Chat, User } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatListItem } from './ChatListItem';
import { CreateGroupDialog } from './CreateGroupDialog';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { chatService } from '@/services/chat.service';
import { useMounted } from '@/hooks/useMounted';
import { initials } from '@/utils/format';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Sidebar({ selectedId, onSelect }: Props): JSX.Element {
  const router = useRouter();
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const chats = useChatStore((s) => s.chats);
  const unread = useChatStore((s) => s.unread);
  const setChats = useChatStore((s) => s.setChats);
  const setUnread = useChatStore((s) => s.setUnread);
  const upsertChat = useChatStore((s) => s.upsertChat);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'dm' | 'groups'>('all');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await chatService.list();
        if (!mounted) return;
        setChats(res.chats);
        setUnread(res.unread);
      } catch {
        toast.error('Failed to load chats');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setChats, setUnread]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return chats
      .filter((c) => {
        if (tab === 'dm') return !c.isGroup;
        if (tab === 'groups') return c.isGroup;
        return true;
      })
      .filter((c) => {
        if (!q) return true;
        if (c.isGroup && c.name?.toLowerCase().includes(q)) return true;
        return c.members.some((m) => m.name.toLowerCase().includes(q));
      });
  }, [chats, tab, search]);

  useEffect(() => {
    let active = true;
    if (!search.trim()) {
      setUserResults([]);
      return;
    }
    setSearchingUsers(true);
    const t = setTimeout(async () => {
      try {
        const found = await chatService.searchUsers(search);
        if (!active) return;
        const knownIds = new Set<string>();
        for (const c of chats) {
          if (!c.isGroup) {
            for (const m of c.members) knownIds.add(m._id);
          }
        }
        setUserResults(found.filter((u) => !knownIds.has(u._id)));
      } catch {
        setUserResults([]);
      } finally {
        if (active) setSearchingUsers(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search, chats]);

  const startDM = async (otherId: string): Promise<void> => {
    try {
      const chat: Chat = await chatService.accessOneToOne(otherId);
      upsertChat(chat);
      setSearch('');
      setUserResults([]);
      onSelect(chat._id);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? 'Failed to open chat'
        : 'Failed to open chat';
      toast.error(msg);
    }
  };

  const onLogout = async (): Promise<void> => {
    await logout();
    router.replace('/login');
  };

  return (
    <aside className="flex h-full w-full flex-col border-r bg-card/30 sm:w-[340px]">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <Link href="/chat" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <MessageCircle className="h-4 w-4" />
          </div>
          <span className="text-base font-bold gradient-text">Pulse</span>
        </Link>
        <div className="flex items-center gap-1">
          <CreateGroupDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label="New group">
                <Plus className="h-5 w-5" />
              </Button>
            }
          />
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account">
                <Avatar className="h-7 w-7">
                  {user?.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
                  <AvatarFallback>{initials(user?.name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => router.push('/profile')}>
                <UserIcon className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push('/notifications')}>
                <Bell className="mr-2 h-4 w-4" /> Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void onLogout()}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats or users…"
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="px-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="dm">Direct</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} />
      </Tabs>

      <ScrollArea className="flex-1 px-2 py-2 scrollbar-thin">
        {loading ? (
          <div className="space-y-2 px-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 px-1">
            {filtered.map((c) => (
              <ChatListItem
                key={c._id}
                chat={c}
                currentUserId={user?._id ?? ''}
                active={selectedId === c._id}
                unread={unread[c._id] ?? 0}
                onClick={() => onSelect(c._id)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No chats yet
              </div>
            )}
            {search && (
              <div className="mt-4 px-1">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Start a new chat
                </div>
                {searchingUsers ? (
                  <div className="text-xs text-muted-foreground">Searching…</div>
                ) : userResults.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No matching users</div>
                ) : (
                  <div className="space-y-1">
                    {userResults.map((u) => (
                      <button
                        key={u._id}
                        className="flex w-full items-center gap-3 rounded-lg border p-2 text-left text-sm hover:bg-accent"
                        onClick={() => void startDM(u._id)}
                      >
                        <Avatar className="h-8 w-8">
                          {u.avatar ? <AvatarImage src={u.avatar} alt={u.name} /> : null}
                          <AvatarFallback>{initials(u.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{u.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </ScrollArea>
    </aside>
  );
}
