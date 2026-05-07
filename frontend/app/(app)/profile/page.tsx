'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { useAuthStore } from '@/store/auth.store';
import { uploadService, userService } from '@/services/chat.service';

export default function ProfilePage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setBio(user.bio ?? '');
      setAvatar(user.avatar ?? '');
    }
  }, [user]);

  const onAvatar = async (file: File): Promise<void> => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadService.upload(file);
      setAvatar(uploaded.url);
      toast.success('Avatar uploaded — click Save to apply');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      const updated = await userService.updateProfile({ name, bio, avatar });
      setUser(updated);
      toast.success('Profile updated');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? 'Failed'
        : 'Failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="Profile" description="Update how others see you across chats.">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <UserAvatar userId={user?._id} name={name} src={avatar} size="lg" />
          <div>
            <label className="inline-flex cursor-pointer items-center rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-accent">
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Change avatar'
              )}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onAvatar(f);
                }}
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">PNG, JPG, or WEBP up to 25MB</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-bio">Bio</Label>
            <Textarea
              id="p-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
