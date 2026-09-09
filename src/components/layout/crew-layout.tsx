import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Route, Mic, Wrench, Droplets, Monitor } from 'lucide-react';
import { useStore } from '@/data/store';
import { cn } from '@/lib/utils';
import { Logo } from './admin-layout';
import { Avatar } from '@/components/ui';

const TABS = [
  { name: 'My day', href: '/my/day', icon: Route },
  { name: 'Ticket', href: '/my/ticket', icon: Mic },
  { name: 'Work order', href: '/my/work-order', icon: Wrench },
  { name: 'Backflow', href: '/my/backflow', icon: Droplets },
];

/** Phone-shaped shell for the crew experience. On desktop it sits in a device frame so the demo reads as "the field app". */
export function CrewLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { currentUser, role, setRole } = useStore();
  // The field app is always shown through a crew member's eyes, whatever the office role was.
  useEffect(() => {
    if (role !== 'crew') setRole('crew');
  }, [role, setRole]);
  return (
    <div className="min-h-[100dvh] bg-[hsl(38_22%_92%)] md:flex md:items-center md:justify-center md:py-8">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-background md:min-h-0 md:h-[880px] md:max-h-[92dvh] md:overflow-hidden md:rounded-[2.4rem] md:border-[9px] md:border-[hsl(202_30%_12%)] md:shadow-[0_30px_80px_-20px_rgba(20,30,40,0.45)]">
        <header className="flex items-center justify-between border-b border-border/70 bg-background/95 px-4 pt-3.5 pb-3 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <Logo small />
            <div className="leading-tight">
              <div className="text-[13.5px] font-semibold">Sundown Field</div>
              <div className="text-[11.5px] text-muted-foreground">Tue, Sep 8 · Post Falls</div>
            </div>
          </div>
          <Avatar name={currentUser.name} hue="24 86% 56%" className="size-7 text-[10px]" />
        </header>
        <main className="flex-1 overflow-y-auto pb-20 scrollbar-thin">{children}</main>
        <nav className="absolute inset-x-0 bottom-0 grid grid-cols-4 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          {TABS.map((t) => {
            const active = location.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={cn('flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                <t.icon className={cn('size-5', active && 'text-accent')} strokeWidth={active ? 2.2 : 1.9} />
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
        className="surface fixed bottom-4 left-4 z-50 hidden items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted md:flex"
      >
        <Monitor className="size-4 text-muted-foreground" /> Back to office
      </button>
    </div>
  );
}
