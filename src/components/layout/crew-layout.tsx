import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Route, Mic, Wrench, Droplets, Monitor } from 'lucide-react';
import { useStore } from '@/data/store';
import { cn } from '@/lib/utils';
import { Logo } from './admin-layout';
import { Avatar } from '@/components/ui';

const TABS = [
  { name: 'My Day', href: '/my/day', icon: Route },
  { name: 'Ticket', href: '/my/ticket', icon: Mic },
  { name: 'Work Order', href: '/my/work-order', icon: Wrench },
  { name: 'Backflow', href: '/my/backflow', icon: Droplets },
];

/** Phone-shaped shell for the crew experience. On desktop it renders inside a device frame so the demo reads as "the field app". */
export function CrewLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { currentUser, role, setRole } = useStore();
  // The field app is always shown through a crew member's eyes, whatever the office role was.
  useEffect(() => {
    if (role !== 'crew') setRole('crew');
  }, [role, setRole]);
  return (
    <div className="min-h-[100dvh] bg-[hsl(196_40%_12%)] md:flex md:items-center md:justify-center md:py-8">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-background md:min-h-0 md:h-[880px] md:max-h-[92dvh] md:overflow-hidden md:rounded-[2.2rem] md:border-[10px] md:border-black md:shadow-2xl">
        <header className="flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground">
          <div className="flex items-center gap-2">
            <Logo small />
            <div className="leading-tight">
              <div className="text-sm font-bold">Sundown Field</div>
              <div className="text-[10px] text-sidebar-foreground/60">Tue, Sep 8 · Post Falls, ID</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Avatar name={currentUser.name} hue="24 90% 59%" className="size-7 text-[10px]" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-20 scrollbar-thin">{children}</main>
        <nav className="absolute inset-x-0 bottom-0 grid grid-cols-4 border-t bg-card/95 backdrop-blur">
          {TABS.map((t) => {
            const active = location.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', active ? 'text-accent-foreground' : 'text-muted-foreground')}>
                <t.icon className={cn('size-5', active && 'text-accent')} />
                {t.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        type="button"
        onClick={() => {
          setRole('owner');
          navigate('/dashboard');
        }}
        className="fixed bottom-4 left-4 z-50 hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur hover:bg-white/20 md:flex"
      >
        <Monitor className="size-4" /> Back to office view
      </button>
    </div>
  );
}
