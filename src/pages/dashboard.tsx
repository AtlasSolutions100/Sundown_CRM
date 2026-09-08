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
      <PageHeader
        eyebrow="Sundown Lawn & Irrigation"
        title="Operations Dashboard"
        subtitle={`${format(parseISO(data.today), 'EEEE, MMMM d, yyyy')} · What was sold, what got done, what needs you.`}
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Jobs today" value={todayJobs.length} sub={`${doneToday} completed`} icon={<Briefcase />} onClick={() => navigate('/schedule')} />
        <Stat label="Behind on contracts" value={behindContracts.length} sub={behindContracts.length ? `worst: ${behindContracts[0].worstDaysBehind}d overdue` : 'All caught up'} tone={behindContracts.length ? 'danger' : 'success'} icon={<ClipboardCheck />} onClick={() => navigate('/contracts')} />
        <Stat label="Invoices to approve" value={pendingInvoices.length} sub={money(pendingTotal)} tone={pendingInvoices.length ? 'accent' : 'default'} icon={<Receipt />} onClick={() => navigate('/invoices')} />
        <Stat label="Open requests" value={openTickets.length} sub={urgentTickets.length ? `${urgentTickets.length} urgent` : 'None urgent'} tone={urgentTickets.length ? 'warning' : 'default'} icon={<Ticket />} onClick={() => navigate('/tickets')} />
        <Stat label="Unfiled inbox" value={unfiled.length} sub="Unknown sender" icon={<Inbox />} onClick={() => navigate('/inbox')} />
        <Stat label="Revenue MTD" value={money(revenueThisMonth(data), { cents: false })} sub={`${money(revenueYtd(data), { cents: false })} YTD`} tone="success" icon={<DollarSign />} onClick={() => navigate('/reports')} />
      </div>

      {/* Weather automation strip */}
      <Card className="mt-5 border-info/30 bg-info/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-info/15 text-info">
            <CloudRain className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Weather check ran 5:00 AM</div>
            <div className="text-sm text-muted-foreground">0.35 in rain forecast Thu Sep 10 at Hayden / Post Falls. Rule "Rain – skip fert & mowing" suggests holding {holdCandidates.length + heldCandidates.length} fertilizer round{holdCandidates.length + heldCandidates.length === 1 ? '' : 's'} scheduled Wed–Thu.</div>
            {(holdCandidates.length > 0 || heldCandidates.length > 0) && (
              <div className="mt-1 flex flex-wrap gap-1.5">
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
            {holdCandidates.length === 0 && heldCandidates.length === 0 && <Badge tone="success">Nothing to hold</Badge>}
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
                <div className="divide-y">
                  {behindContracts.slice(0, 6).map((p) => (
                    <Link key={p.contract.id} href="/contracts" className="block py-3 first:pt-0 last:pb-0 hover:bg-muted/30">
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
                <AlertTriangle className="size-4 text-accent" /> Needs you
              </CardTitle>
              <CardDescription>Human-in-the-loop items, most urgent first</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
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
              {urgentTickets.length + overdueInvoices.length + pendingInvoices.length + unfiled.length === 0 && <EmptyState title="Queue is clear" description="Nothing waiting on a decision from you." />}
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
                    <div className="mb-1.5 flex items-center justify-between">
                      <CrewChip crewId={c.id} />
                      <span className="text-xs text-muted-foreground">
                        {jobs.filter((j) => j.status === 'done').length}/{jobs.length} done
                      </span>
                    </div>
                    {jobs.length === 0 ? (
                      <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">No jobs scheduled.</div>
                    ) : (
                      <ol className="space-y-1">
                        {jobs.map((j) => (
                          <li key={j.id} className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm', j.status === 'in_progress' && 'border-accent/50 bg-accent/5')}>
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold tabular">{j.routeOrder ?? '·'}</span>
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
  const bar = { danger: 'bg-destructive', accent: 'bg-accent', info: 'bg-info' }[tone];
  return (
    <Link href={href} className="flex items-stretch gap-2.5 rounded-md border bg-card px-2.5 py-2 transition-colors hover:border-primary/40 hover:bg-primary/5">
      <span className={cn('w-1 shrink-0 rounded-full', bar)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      <ArrowRight className="size-4 self-center text-muted-foreground" />
    </Link>
  );
}
