import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, ClipboardCheck, Ticket, CalendarRange, Droplets, Receipt, Users, FileText, Layers,
  Package, Timer, BarChart3, Inbox, UserCog, Settings2, Menu, Sun, Wrench, RefreshCw, Smartphone,
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
      { name: 'Completion Audit', href: '/contracts', icon: ClipboardCheck, badge: (c) => c.behind, tone: 'danger' },
      { name: 'Service Requests', href: '/tickets', icon: Ticket, badge: (c) => c.openTickets },
      { name: 'Schedule & Routes', href: '/schedule', icon: CalendarRange },
      { name: 'Work Orders', href: '/work-orders', icon: Wrench },
      { name: 'Backflow', href: '/backflow', icon: Droplets },
      { name: 'Inbox', href: '/inbox', icon: Inbox, badge: (c) => c.unfiled + c.unread, tone: 'accent' },
    ],
  },
  {
    section: 'Money',
    items: [
      { name: 'Invoices', href: '/invoices', icon: Receipt, badge: (c) => c.pendingInvoices, tone: 'accent' },
      { name: 'Estimates', href: '/estimates', icon: FileText },
      { name: 'Job Costing', href: '/reports', icon: BarChart3 },
      { name: 'Time & Geofence', href: '/time', icon: Timer },
    ],
  },
  {
    section: 'Setup',
    items: [
      { name: 'Clients', href: '/clients', icon: Users },
      { name: 'Services & Packages', href: '/services', icon: Layers },
      { name: 'Parts & Pricing', href: '/parts', icon: Package },
      { name: 'Team', href: '/team', icon: UserCog },
      { name: 'Settings', href: '/settings', icon: Settings2 },
    ],
  },
];

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', ops: 'Ops Manager', foreman: 'Foreman', crew: 'Crew' };

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
      <div className="flex items-center gap-3 px-5 py-5">
        <Logo />
        <div className="leading-tight">
          <div className="text-base font-bold tracking-tight">Sundown CRM</div>
          <div className="text-[11px] text-sidebar-foreground/60">Lawn · Irrigation · Backflow</div>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 scrollbar-thin">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">{group.section}</div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = location === item.href || location.startsWith(item.href + '/');
                const n = item.badge?.(ctx);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <item.icon className={cn('size-4.5', active ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/60')} />
                    <span className="flex-1">{item.name}</span>
                    {!!n && (
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular leading-none', active ? 'bg-black/15 text-sidebar-primary-foreground' : item.tone === 'danger' ? 'bg-destructive text-white' : 'bg-accent text-accent-foreground')}>{n}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-2 rounded-md bg-sidebar-accent/60 p-2">
          <Avatar name={currentUser.name} hue="24 90% 59%" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold">{currentUser.name}</div>
            <div className="text-[11px] text-sidebar-foreground/60">{ROLE_LABEL[role]}</div>
          </div>
        </div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">Preview as</label>
        <select
          value={role}
          onChange={(e) => {
            const r = e.target.value as Role;
            setRole(r);
            if (r === 'crew') navigate('/my/day');
          }}
          className="mt-1 h-8 w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 text-xs text-sidebar-foreground focus:outline-none"
        >
          <option value="owner">Owner (David)</option>
          <option value="ops">Ops Manager</option>
          <option value="foreman">Foreman</option>
          <option value="crew">Crew (mobile view)</option>
        </select>
        <div className="mt-2 flex gap-1">
          <button type="button" onClick={() => navigate('/my/day')} className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <Smartphone className="size-3.5" /> Crew app
          </button>
          <button type="button" onClick={() => { if (confirm('Reset all demo data to the original seed?')) reset(); }} className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <RefreshCw className="size-3.5" /> Reset demo
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar text-sidebar-foreground shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
          <div className="flex items-center gap-2">
            <Logo small />
            <span className="font-bold">Sundown CRM</span>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-sidebar-accent" aria-label="Menu">
            <Menu className="size-5" />
          </button>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <span className={cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[hsl(24_90%_59%)] shadow-inner', small ? 'size-8' : 'size-10')}>
      <Sun className={cn('text-white', small ? 'size-5' : 'size-6')} strokeWidth={2.4} />
      <span className="absolute inset-x-0 bottom-0 h-[38%] bg-[hsl(140_40%_34%)]" />
    </span>
  );
}
