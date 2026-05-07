'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import { LogOut, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { Chat, User } from '@/types';
import { UserAvatar } from './UserAvatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatService } from '@/services/chat.service';
import { useChatStore } from '@/store/chat.store';
import { EMPTY_MESSAGES } from '@/constants/empty';
import { formatBytes, formatRelative } from '@/utils/format';

interface Props {
  chat: Chat;
  currentUserId: string;
}

export function ChatInfoPanel({ chat, currentUserId }: Props): JSX.Element {
  const upsertChat = useChatStore((s) => s.upsertChat);
  const rawMessages = useChatStore((s) => s.messagesByChat[chat._id]);
  const messages = rawMessages === undefined ? EMPTY_MESSAGES : rawMessages;
  const selectChat = useChatStore((s) => s.selectChat);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const isAdmin = useMemo(
    () => chat.admins.some((a) => a._id === currentUserId),
    [chat.admins, currentUserId],
  );

  const sharedMedia = useMemo(
    () => messages.filter((m) => m.type === 'image' && m.attachment).slice(-9).reverse(),
    [messages],
  );

  const counterpart = !chat.isGroup ? chat.members.find((m) => m._id !== currentUserId) : null;

  const onSearch = async (q: string): Promise<void> => {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const found = await chatService.searchUsers(q);
      const memberIds = new Set(chat.members.map((m) => m._id));
      setSearchResults(found.filter((u) => !memberIds.has(u._id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addMember = async (userId: string): Promise<void> => {
    try {
      const updated = await chatService.addMember(chat._id, userId);
      upsertChat(updated);
      setSearch('');
      setSearchResults([]);
      toast.success('Member added');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? 'Failed'
        : 'Failed';
      toast.error(msg);
    }
  };

  const removeMember = async (userId: string): Promise<void> => {
    try {
      const updated = await chatService.removeMember(chat._id, userId);
      upsertChat(updated);
      toast.success('Member removed');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? 'Failed'
        : 'Failed';
      toast.error(msg);
    }
  };

  const leave = async (): Promise<void> => {
    try {
      await chatService.leaveGroup(chat._id);
      selectChat(null);
      toast.success('Left group');
    } catch {
      toast.error('Failed to leave');
    }
  };

  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-l bg-card/30 lg:flex">
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <UserAvatar
          userId={counterpart?._id}
          name={chat.isGroup ? chat.name : counterpart?.name}
          src={chat.isGroup ? chat.avatar : counterpart?.avatar}
          size="lg"
          showStatus={!chat.isGroup}
        />
        <div>
          <div className="text-base font-semibold">
            {chat.isGroup ? chat.name : counterpart?.name}
          </div>
          {!chat.isGroup && counterpart?.email && (
            <div className="text-xs text-muted-foreground">{counterpart.email}</div>
          )}
          {chat.isGroup && (
            <div className="text-xs text-muted-foreground">{chat.members.length} members</div>
          )}
        </div>
        {!chat.isGroup && counterpart?.bio && (
          <p className="px-2 text-xs italic text-muted-foreground">{counterpart.bio}</p>
        )}
      </div>
      <Separator />

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shared Media
          </div>
          {sharedMedia.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              No shared media yet
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {sharedMedia.map((m) =>
                m.attachment ? (
                  <a
                    key={m._id}
                    href={m.attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square overflow-hidden rounded-md border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.attachment.url}
                      alt={m.attachment.name}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ) : null,
              )}
            </div>
          )}
        </div>

        {chat.isGroup && (
          <>
            <Separator />
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Members
                </div>
                {isAdmin && <span className="text-[10px] text-primary">Admin</span>}
              </div>
              <div className="space-y-1">
                {chat.members.map((m) => {
                  const isMemberAdmin = chat.admins.some((a) => a._id === m._id);
                  return (
                    <div
                      key={m._id}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/50"
                    >
                      <UserAvatar userId={m._id} name={m.name} src={m.avatar} size="sm" showStatus />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          {m.name}
                          {m._id === currentUserId && (
                            <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                          )}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {isMemberAdmin ? 'Admin' : 'Member'}
                        </div>
                      </div>
                      {isAdmin && m._id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void removeMember(m._id)}
                          aria-label="Remove member"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {isAdmin && (
                <div className="mt-4">
                  <div className="mb-1 text-xs text-muted-foreground">Add member</div>
                  <Input
                    placeholder="Search users…"
                    value={search}
                    onChange={(e) => void onSearch(e.target.value)}
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {searchResults.map((u) => (
                        <div
                          key={u._id}
                          className="flex items-center gap-2 rounded-lg border bg-background/50 p-2"
                        >
                          <UserAvatar userId={u._id} name={u.name} src={u.avatar} size="sm" />
                          <div className="min-w-0 flex-1 text-sm">{u.name}</div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void addMember(u._id)}
                            aria-label="Add"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {searching && <div className="mt-2 text-xs text-muted-foreground">Searching…</div>}
                </div>
              )}
            </div>

            <div className="p-4">
              <Button variant="destructive" className="w-full gap-2" onClick={() => void leave()}>
                <LogOut className="h-4 w-4" /> Leave group
              </Button>
            </div>
          </>
        )}

        <Separator />
        <div className="p-4 text-[11px] text-muted-foreground">
          Created {formatRelative(chat.createdAt)} • {formatBytes(0)} cached
        </div>
      </div>
    </aside>
  );
}
