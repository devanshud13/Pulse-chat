'use client';

import { useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { chatService } from '@/services/chat.service';
import { useChatStore } from '@/store/chat.store';
import type { User } from '@/types';
import { initials } from '@/utils/format';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Props {
  trigger: ReactNode;
}

export function CreateGroupDialog({ trigger }: Props): JSX.Element {
  const upsertChat = useChatStore((s) => s.upsertChat);
  const selectChat = useChatStore((s) => s.selectChat);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setSearch('');
      setResults([]);
      setSelected([]);
    }
  }, [open]);

  useEffect(() => {
    let active = true;
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const found = await chatService.searchUsers(search);
        if (!active) return;
        const selectedIds = new Set(selected.map((s) => s._id));
        setResults(found.filter((u) => !selectedIds.has(u._id)));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search, selected]);

  const create = async (): Promise<void> => {
    if (!name.trim() || selected.length === 0) {
      toast.error('Add a name and at least one member');
      return;
    }
    setCreating(true);
    try {
      const chat = await chatService.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        members: selected.map((s) => s._id),
      });
      upsertChat(chat);
      selectChat(chat._id);
      toast.success('Group created');
      setOpen(false);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? 'Failed'
        : 'Failed';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>Give it a name and add members to start chatting.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Name</Label>
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Description (optional)</Label>
            <Textarea
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Members</Label>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selected.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => setSelected((s) => s.filter((x) => x._id !== u._id))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-1 text-xs text-primary hover:bg-primary/25"
                  >
                    {u.name} ×
                  </button>
                ))}
              </div>
            )}
            <Input
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {results.length > 0 && (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-1 scrollbar-thin">
                {results.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => {
                      setSelected((s) => [...s, u]);
                      setResults((r) => r.filter((x) => x._id !== u._id));
                    }}
                    className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-accent"
                  >
                    <Avatar className="h-7 w-7">
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
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
