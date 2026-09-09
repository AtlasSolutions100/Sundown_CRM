import { Link, useLocation } from 'wouter';
import { format, parseISO } from 'date-fns';
import { Briefcase, ClipboardCheck, Receipt, Ticket, Inbox, DollarSign, CloudRain, ArrowRight, AlertTriangle, Timer } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Progress, MilestoneBar, Stat, PageHeader, EmptyState, useToast, type Tone } from '@/components/ui';
import { useLookups, JobStatusBadge, CrewChip } from '@/components/shared';
import { allContractProgress, billableSplit, revenueThisMonth, revenueYtd, invoiceTotal, type LineState } from '@/lib/metrics';
import { money, pct, sum, fmtDate, daysBetween, cn } from '@/lib/utils';

const LINE_TONE: Record<LineState, Tone | 'empty'> = {
  done: 'success',
  behind: 'danger',
  due: 'warning',
  scheduled: 'info',
  upcoming: 'empty',
  skipped: 'neutral',
};

export default function Dashboard() {
  const { data, currentUser, actions } = useStore();
  const { property, client, service, crew } = useLookups();
  const [, navigate] = useLocation();
  const toast = useToast();

  const todayJobs = data.jobs.filter((j) => j.scheduledDate === data.today && ['scheduled', 'en_route', 'in_progress', 'done', 'weather_hold'].includes(j.status));
  const doneToday = todayJobs.filter((j) => j.status === 'done').length;

  const progress = allContractProgress(data);
  const behindContracts = progress.filter((p) => p.behind > 0);

  const pendingInvoices = data.invoices.filter((i) => i.status === 'pending_approval');
  const pendingTotal = sum(pendingInvoices.map(invoiceTotal));
  const overdueInvoices = data.invoices.filter((i) => i.status === 'overdue');

  const openTickets = data.tickets.filter((t) => !['invoiced', 'closed'].includes(t.stage));
  const urgentTickets = openTickets.filter((t) => t.priority === 'urgent');

  const unfiled = data.messages.filter((m) => !m.clientId);

  const split = billableSplit(data, currentUser, 14);
  const target = data.settings.billableTargetPct / 100;

  const holdCandidates = data.jobs.filter((j) => j.serviceId === 'svc_fert' && (j.scheduledDate === '2026-09-09' || j.scheduledDate === '2026-09-10') && j.status === 'scheduled');
  const heldCandidates = data.jobs.filter((j) => j.serviceId === 'svc_fert' && (j.scheduledDate === '2026-09-09' || j.scheduledDate === '2026-09-10') && j.status === 'weather_hold');

  const holdAll = () => {
    holdCandidates.forEach((j) => actions.weatherHold(j.id, true));
    toast({ title: `${holdCandidates.length} fert round${holdCandidates.length === 1 ? '' : 's'} put on weather hold`, description: 'They will be re-suggested on the first dry day.', tone: 'info' });
  };
  const releaseAll = () => {
    heldCandidates.forEach((j) => actions.weatherHold(j.id, false));
    toast({ title: 'Weather hold released', description: `${heldCandidates.length} job(s) back on the schedule.` });
  };

  return (
    <div>
      {/* Greeting: the one authored brand moment on the page. Sunset over turf, then straight into the numbers. */}
      <div className="surface relative mb-5 overflow-hidden px-6 py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_220px_at_92%_-20%,hsl(24_86%_56%/0.35),transparent_65%),radial-gradient(420px_200px_at_70%_120%,hsl(178_45%_40%/0.16),transparent_65%)]" />
        <div className="pointer-events-none absolute right-8 top-4 hidden size-16 rounded-full bg-[radial-gradient(circle_at_40%_35%,hsl(30_95%_70%),hsl(22_86%_52%)_70%)] shadow-[0_8px_30px_-8px_hsl(24_86%_56%/0.7)] sm:block" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-3 bg-[linear-gradient(90deg,hsl(145_42%_36%/0.55),hsl(145_42%_36%/0.15)_60%,transparent)] sm:block" />
        <div className="relative">
          <div className="text-[12.5px] font-medium text-muted-foreground">{format(parseISO(data.today), 'EEEE, MMMM d')}</div>
          <h1 className="mt-0.5 text-[26px] font-semibold leading-tight tracking-tight">Good morning, {currentUser.name.split(' ')[0]}.</h1>
          <p className="mt-1 max-w-xl text-[13.5px] text-muted-foreground">
            {todayJobs.length} stops out today, {behindContracts.length} contract{behindContracts.length === 1 ? '' : 's'} behind, {pendingInvoices.length} invoice{pendingInvoices.length === 1 ? '' : 's'} waiting on you.
          </p>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Jobs today" value={todayJobs.length} sub={`${doneToday} completed`} icon={<Briefcase />} onClick={() => navigate('/schedule')} />
        <Stat label="Behind on contracts" value={behindContracts.length} sub={behindContracts.length ? `worst: ${behindContracts[0].worstDaysBehind}d overdue` : 'All caught up'} tone={behindContracts.length ? 'danger' : 'default'} icon={<ClipboardCheck />} onClick={() => navigate('/contracts')} />
        <Stat label="Invoices to approve" value={pendingInvoices.length} sub={money(pendingTotal)} icon={<Receipt />} onClick={() => navigate('/invoices')} />
        <Stat label="Open requests" value={openTickets.length} sub={urgentTickets.length ? `${urgentTickets.length} urgent` : 'None urgent'} icon={<Ticket />} onClick={() => navigate('/tickets')} />
        <Stat label="Unfiled inbox" value={unfiled.length} sub="Unknown sender" icon={<Inbox />} onClick={() => navigate('/inbox')} />
        <Stat label="Revenue MTD" value={money(revenueThisMonth(data), { cents: false })} sub={`${money(revenueYtd(data), { cents: false })} YTD`} icon={<DollarSign />} onClick={() => navigate('/reports')} />
      </div>

      {/* Weather automation strip: the one callout on the page */}
      <Card className="mt-5">
        <CardContent className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
          <CloudRain className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <span className="font-medium">Weather check ran 5:00 AM.</span>{' '}
              <span className="text-muted-foreground">0.35 in rain forecast Thu Sep 10 at Hayden / Post Falls. Rule "Rain – skip fert & mowing" suggests holding {holdCandidates.length + heldCandidates.length} fertilizer round{holdCandidates.length + heldCandidates.length === 1 ? '' : 's'} scheduled Wed–Thu.</span>
            </div>
            {(holdCandidates.length > 0 || heldCandidates.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[...holdCandidates, ...heldCandidates].map((j) => (
                  <Badge key={j.id} tone={j.status === 'weather_hold' ? 'warning' : 'outline'}>
                    {property(j.propertyId)?.name} · {fmtDate(j.scheduledDate)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {holdCandidates.length > 0 && (
              <Button size="sm" variant="primary" onClick={holdAll}>
                Hold {holdCandidates.length} job{holdCandidates.length === 1 ? '' : 's'}
              </Button>
            )}
            {heldCandidates.length > 0 && (
              <Button size="sm" variant="outline" onClick={releaseAll}>
                Release hold
              </Button>
            )}
            {holdCandidates.length === 0 && heldCandidates.length === 0 && <span className="text-xs text-muted-foreground">Nothing to hold</span>}
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column: billable + most behind */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="size-4 text-muted-foreground" /> Billable vs non-billable
                </CardTitle>
                <CardDescription>Last 14 days · {currentUser.name} · from geofence visits vs clocked hours</CardDescription>
              </div>
              <Badge tone={split.ratio >= target ? 'success' : split.ratio >= target * 0.7 ? 'warning' : 'danger'}>{pct(split.ratio)} billable</Badge>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Progress value={split.ratio} tone={split.ratio >= target ? 'success' : split.ratio >= target * 0.7 ? 'warning' : 'danger'} height="h-3" />
                <div className="absolute top-[-4px] h-5 w-0.5 bg-foreground/70" style={{ left: `${target * 100}%` }} title={`Target ${data.settings.billableTargetPct}%`} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{split.billable.toFixed(1)} h billable</span>
                <span>{split.nonBillable.toFixed(1)} h office / drive / admin</span>
                <span>{split.total.toFixed(1)} h tracked</span>
              </div>
              <p className="mt-3 text-sm">
                You spent <span className="font-semibold">{pct(split.ratio)}</span> of tracked time on billable work; target <span className="font-semibold">{data.settings.billableTargetPct}%</span>.
                {split.ratio < target && <span className="text-muted-foreground"> Every hour this system saves you on invoicing, scheduling and reports moves this bar to the right.</span>}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Most behind</CardTitle>
                <CardDescription>Contract items whose window closed without being done, farthest overdue first</CardDescription>
              </div>
              <Link href="/contracts" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Full audit <ArrowRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {behindContracts.length === 0 ? (
                <EmptyState icon={<ClipboardCheck />} title="Nothing behind" description="Every contracted service is done or inside its window." />
              ) : (
                <div className="-mx-5 divide-y divide-border/70">
                  {behindContracts.slice(0, 6).map((p) => (
                    <Link key={p.contract.id} href="/contracts" className="block px-5 py-3 transition-colors hover:bg-muted/40">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{p.client.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {p.property.name} · {p.done}/{p.total} done · {p.lines.filter((l) => l.state === 'behind').map((l) => `${service(l.serviceId)?.name ?? ''} ${l.label}`).join(', ')}
                          </div>
                        </div>
                        <Badge tone="danger" dot>
                          {p.worstDaysBehind}d behind
                        </Badge>
                      </div>
                      <MilestoneBar className="mt-2" cells={p.lines.map((l) => ({ tone: LINE_TONE[l.state], title: `${service(l.serviceId)?.name ?? ''} – ${l.label} (${fmtDate(l.windowStart)}–${fmtDate(l.windowEnd)}): ${l.state}` }))} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: needs you + crews */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-muted-foreground" /> Needs you
              </CardTitle>
              <CardDescription>Human-in-the-loop items, most urgent first</CardDescription>
            </CardHeader>
            <CardContent>
              {urgentTickets.length + overdueInvoices.length + pendingInvoices.length + unfiled.length === 0 ? (
                <EmptyState title="Queue is clear" description="Nothing waiting on a decision from you." />
              ) : (
                <div className="-mx-5 divide-y divide-border/70">
                  {urgentTickets.map((tk) => (
                    <QueueRow key={tk.id} href="/tickets" tone="danger" label={`Urgent: #${tk.number} ${tk.title}`} sub={client(tk.clientId)?.name ?? 'Unassigned'} />
                  ))}
                  {overdueInvoices.map((i) => (
                    <QueueRow key={i.id} href="/invoices" tone="danger" label={`Overdue: Invoice #${i.number} · ${money(invoiceTotal(i))}`} sub={`${client(i.clientId)?.name} · ${daysBetween(i.dueDate, data.today)}d past due · ${i.remindersSent} reminder${i.remindersSent === 1 ? '' : 's'} sent`} />
                  ))}
                  {pendingInvoices.map((i) => (
                    <QueueRow key={i.id} href="/invoices" tone="accent" label={`Approve invoice #${i.number} · ${money(invoiceTotal(i))}`} sub={`${client(i.clientId)?.name} · ${i.sourceLabel.replace('Auto: ', '')}`} />
                  ))}
                  {unfiled.map((m) => (
                    <QueueRow key={m.id} href="/inbox" tone="info" label={`File ${m.channel} from ${m.from}`} sub={m.body.slice(0, 70) + (m.body.length > 70 ? '…' : '')} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today's crews</CardTitle>
              <CardDescription>Route order · live from the field</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.crews.map((c) => {
                const jobs = todayJobs.filter((j) => j.crewId === c.id).sort((a, b) => (a.routeOrder ?? 99) - (b.routeOrder ?? 99));
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between pb-1">
                      <CrewChip crewId={c.id} />
                      <span className="num text-xs text-muted-foreground">
                        {jobs.filter((j) => j.status === 'done').length}/{jobs.length} done
                      </span>
                    </div>
                    {jobs.length === 0 ? (
                      <div className="py-2 text-xs text-muted-foreground">No jobs scheduled.</div>
                    ) : (
                      <ol className="divide-y divide-border/70">
                        {jobs.map((j) => (
                          <li key={j.id} className="flex items-center gap-2.5 py-2 text-sm">
                            <span className={cn('num w-4 shrink-0 text-center text-xs', j.status === 'in_progress' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{j.routeOrder ?? '·'}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{property(j.propertyId)?.name}</div>
                              <div className="truncate text-xs text-muted-foreground">{j.title}</div>
                            </div>
                            <JobStatusBadge status={j.status} />
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
              {(() => {
                const unassigned = todayJobs.filter((j) => !crew(j.crewId));
                return unassigned.length ? <div className="text-xs text-muted-foreground">{unassigned.length} job(s) today without a crew.</div> : null;
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QueueRow({ href, tone, label, sub }: { href: string; tone: 'danger' | 'accent' | 'info'; label: string; sub?: string }) {
  const dot = { danger: 'bg-destructive', accent: 'bg-accent', info: 'bg-muted-foreground/50' }[tone];
  return (
    <Link href={href} className="flex items-center gap-2.5 px-5 py-2.5 transition-colors hover:bg-muted/40">
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/60" />
    </Link>
  );
}
