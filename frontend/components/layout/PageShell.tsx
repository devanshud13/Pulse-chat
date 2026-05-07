'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function PageShell({ title, description, children }: Props): JSX.Element {
  return (
    <div className="min-h-screen gradient-bg">
      <div className="container max-w-3xl py-8">
        <Link href="/chat">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to chats
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
