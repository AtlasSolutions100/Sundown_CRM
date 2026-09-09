import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, ClipboardCheck, Ticket, CalendarRange, Droplets, Receipt, Users, FileText, Layers,
  Package, Timer, BarChart3, Inbox, UserCog, Settings2, Menu, Wrench, RefreshCw, Smartphone, ChevronsUpDown,
} from 'lucide-react';
import { useStore } from '@/data/store';
import { allContractProgress } from '@/lib/metrics';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import type { Role } from '@/data/types';

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: (ctx: BadgeCtx) => number | undefined;
  tone?: 'accent' | 'danger';
}
interface BadgeCtx {
  behind: number;
  openTickets: number;
  pendingInvoices: number;
  unfiled: number;
  unread: number;
  overdue: number;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Operate',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Completion audit', href: '/contracts', icon: ClipboardCheck, badge: (c) => c.behind, tone: 'danger' },
      { name: 'Service requests', href: '/tickets', icon: Ticket, badge: (c) => c.openTickets },
      { name: 'Schedule & routes', href: '/schedule', icon: CalendarRange },
      { name: 'Work orders', href: '/work-orders', icon: Wrench },
      { name: 'Backflow', href: '/backflow', icon: Droplets },
      { name: 'Inbox', href: '/inbox', icon: Inbox, badge: (c) => c.unfiled + c.unread, tone: 'accent' },
    ],
  },
  {
    section: 'Money',
    items: [
      { name: 'Invoices', href: '/invoices', icon: Receipt, badge: (c) => c.pendingInvoices, tone: 'accent' },
      { name: 'Estimates', href: '/estimates', icon: FileText },
      { name: 'Job costing', href: '/reports', icon: BarChart3 },
      { name: 'Time & geofence', href: '/time', icon: Timer },
    ],
  },
  {
    section: 'Setup',
    items: [
      { name: 'Clients', href: '/clients', icon: Users },
      { name: 'Services & packages', href: '/services', icon: Layers },
      { name: 'Parts & pricing', href: '/parts', icon: Package },
      { name: 'Team', href: '/team', icon: UserCog },
      { name: 'Settings', href: '/settings', icon: Settings2 },
    ],
  },
];

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', ops: 'Ops manager', foreman: 'Foreman', crew: 'Crew' };

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { data, role, setRole, currentUser, reset } = useStore();
  const [open, setOpen] = useState(false);
  // The office shell is never viewed as a crew member; crew lands in the field app instead.
  useEffect(() => {
    if (role === 'crew') setRole('owner');
  }, [role, setRole]);

  const ctx: BadgeCtx = {
    behind: allContractProgress(data).filter((p) => p.behind > 0).length,
    openTickets: data.tickets.filter((t) => !['invoiced', 'closed'].includes(t.stage)).length,
    pendingInvoices: data.invoices.filter((i) => i.status === 'pending_approval').length,
    unfiled: data.messages.filter((m) => !m.clientId).length,
    unread: data.messages.filter((m) => m.clientId && !m.read && m.direction === 'in').length,
    overdue: data.invoices.filter((i) => i.status === 'overdue').length,
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Workspace */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Logo />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13.5px] font-semibold text-foreground">Sundown Lawn & Irrigation</div>
          <div className="text-[11.5px] text-muted-foreground">Post Falls, ID</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2 scrollbar-thin">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="px-2 pb-1 text-[11.5px] font-medium text-muted-foreground/80">{group.section}</div>
            <div className="flex flex-col gap-px">
              {group.items.map((item) => {
                const active = location === item.href || location.startsWith(item.href + '/');
                const n = item.badge?.(ctx);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-colors',
                      active ? 'bg-foreground/[0.07] font-medium text-foreground' : 'text-sidebar-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                    )}
                  >
                    <item.icon className={cn('size-4', active ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground/70')} strokeWidth={active ? 2.2 : 1.9} />
                    <span className="flex-1 truncate">{item.name}</span>
                    {!!n && (
                      <span className={cn('num min-w-5 rounded px-1 py-0.5 text-center text-[11px] leading-none', item.tone === 'danger' ? 'bg-destructive/10 font-semibold text-destructive' : 'text-muted-foreground')}>{n}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Persona */}
      <div className="border-t border-sidebar-border p-3">
        <label className="relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-foreground/[0.04]">
          <Avatar name={currentUser.name} hue="24 86% 56%" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium text-foreground">{currentUser.name}</div>
            <div className="text-[11.5px] text-muted-foreground">{ROLE_LABEL[role]} · preview as</div>
          </div>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          <select
            aria-label="Preview as role"
            value={role}
            onChange={(e) => {
              const r = e.target.value as Role;
              setRole(r);
              if (r === 'crew') navigate('/my/day');
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="owner">Owner (David)</option>
            <option value="ops">Ops manager</option>
            <option value="foreman">Foreman</option>
            <option value="crew">Crew (field app)</option>
          </select>
        </label>
        <div className="mt-1 flex gap-1">
          <button type="button" onClick={() => navigate('/my/day')} className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground">
            <Smartphone className="size-3.5" /> Field app
          </button>
          <button type="button" onClick={() => { if (confirm('Reset all demo data to the original seed?')) reset(); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground">
            <RefreshCw className="size-3.5" /> Reset demo
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-[hsl(202_34%_10%/0.4)]" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-sidebar px-4 py-2.5 md:hidden">
          <div className="flex items-center gap-2">
            <Logo small />
            <span className="text-[13.5px] font-semibold">Sundown</span>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-foreground/[0.05]" aria-label="Menu">
            <Menu className="size-5" />
          </button>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Brand mark: a setting sun over turf. The only place the two brand colours meet at full strength. */
export function Logo({ small }: { small?: boolean }) {
  const s = small ? 26 : 30;
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill="hsl(202 34% 13%)" />
      <circle cx="16" cy="17" r="7.5" fill="hsl(24 86% 56%)" />
      <rect x="4" y="18.5" width="24" height="9.5" fill="hsl(202 34% 13%)" />
      <path d="M5 20.5h22" stroke="hsl(145 42% 40%)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7.5 24h17" stroke="hsl(145 42% 33%)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
