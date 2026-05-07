'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle, ShieldCheck, Sparkles, Zap, Users, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Zap,
    title: 'Realtime Sync',
    description: 'Sub-second delivery powered by Socket.IO with auto-reconnect and read receipts.',
  },
  {
    icon: ShieldCheck,
    title: 'End-to-end Secure',
    description: 'JWT auth, refresh-token rotation, rate limiting, and hardened HTTP headers.',
  },
  {
    icon: Users,
    title: 'Groups & DMs',
    description: 'Create groups, manage members, share files — built for teams of any size.',
  },
  {
    icon: Bell,
    title: 'Browser Extension',
    description: 'Native Chrome notifications even when the tab is closed. Never miss a message.',
  },
];

export default function LandingPage(): JSX.Element {
  return (
    <main className="relative isolate min-h-screen overflow-hidden gradient-bg">
      <nav className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight gradient-text">Pulse</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">Login</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </nav>

      <section className="container relative pb-32 pt-16 md:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/40 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Production-ready chat platform
          </span>
          <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
            Conversations,
            <span className="block gradient-text">amplified.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            A modern realtime chat platform with native Chrome notifications, groups, file sharing,
            and presence — built for teams that move fast.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Start chatting <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                I already have an account
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="relative mx-auto mt-20 max-w-5xl"
        >
          <div className="rounded-3xl border bg-card/40 p-2 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-1.5 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-rose-500/70" />
              <span className="h-3 w-3 rounded-full bg-amber-500/70" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
            </div>
            <div className="grid h-72 grid-cols-12 gap-1 rounded-2xl border bg-background/60 p-2 sm:h-96">
              <div className="col-span-3 hidden flex-col gap-2 rounded-xl bg-muted/40 p-3 sm:flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="flex items-center gap-2 rounded-lg bg-background/60 p-2 text-xs"
                  >
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/60 to-fuchsia-500/40" />
                    <div className="flex-1">
                      <div className="h-2 w-20 rounded bg-foreground/20" />
                      <div className="mt-1 h-2 w-12 rounded bg-foreground/10" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="col-span-12 flex flex-col gap-2 rounded-xl bg-background/40 p-4 sm:col-span-9">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="self-start max-w-[70%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm"
                >
                  Hey team, ship it today?
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                  className="self-end max-w-[70%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
                >
                  Already deployed
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 }}
                  className="self-start max-w-[70%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm"
                >
                  Insane.
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="container pb-24">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Built for serious teams.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Every detail, from architecture to animation, optimized for production.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="group relative rounded-2xl border bg-card/30 p-6 backdrop-blur transition-colors hover:border-primary/40"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="container flex h-16 items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Pulse Chat</span>
          <span>Built with Next.js, Express, MongoDB & Socket.IO</span>
        </div>
      </footer>
    </main>
  );
}
