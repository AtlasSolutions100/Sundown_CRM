import { useMemo } from 'react';
import { useState } from 'react';
import { Timer, RefreshCw, MapPin, LogIn, LogOut, CheckCircle2, Radar } from 'lucide-react';
import { useStore } from '@/data/store';
import type { TeamMember, TimeEntry } from '@/data/types';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Segmented, Progress, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, EmptyState, Avatar, useToast, Field } from '@/components/ui';
import { useLookups, CrewChip } from '@/components/shared';
import { money, pct, fmtTime, fmtDate, daysBetween, hoursBetween, cn, sum, titleCase } from '@/lib/utils';

type Range = 'today' | 'week' | 'last14';

export default function TimePage() {
  const { data, actions, update, currentUser } = useStore();
  const { property, job, member } = useLookups();
  const toast = useToast();
  const [range, setRange] = useState<Range>('week');

  const inRange = (t: TimeEntry) => {
    const d = daysBetween(t.date, data.today);
    if (range === 'today') return d === 0;
    if (range === 'week') return d >= 0 && d <= 7 && weekKey(t.date) === weekKey(data.today);
    return d >= 0 && d < 14;
  };

  const entries = useMemo(() => data.timeEntries.filter(inRange), [data.timeEntries, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const tracked = (t: TimeEntry) => (t.clockOut ? hoursBetween(t.clockIn, t.clockOut) : hoursBetween(t.clockIn, `${t.date}T${nowHHMM()}:00`));
  const onSite = (t: TimeEntry) => sum(t.visits.map((v) => hoursBetween(v.arrive, v.depart)));

  const totalTracked = sum(entries.map(tracked));
  const totalOnSite = sum(entries.map(onSite));
  const nonBillable = totalTracked ? 1 - totalOnSite / totalTracked : 0;
  const unsynced = data.timeEntries.filter((t) => !t.syncedToQuickBooks && t.clockOut).length;
  const target = data.settings.billableTargetPct / 100;

  const members = data.team.filter((m) => entries.some((e) => e.memberId === m.id));
  const myToday = data.timeEntries.find((t) => t.memberId === currentUser.id && t.date === data.today);

  // By-property rollup
  const byProperty = useMemo(() => {
    const map = new Map<string, { visits: number; hours: number; jobs: Set<string> }>();
    for (const e of entries)
      for (const v of e.visits) {
        const cur = map.get(v.propertyId) ?? { visits: 0, hours: 0, jobs: new Set<string>() };
        cur.visits += 1;
        cur.hours += hoursBetween(v.arrive, v.depart);
        v.jobIds.forEach((id) => cur.jobs.add(id));
        map.set(v.propertyId, cur);
      }
    return [...map.entries()].sort((a, b) => b[1].hours - a[1].hours);
  }, [entries]);

  return (
    <div>
      <PageHeader
       
        title="Time & Geofence"
        subtitle="Clock in once. Visits log themselves by geofence. Hours flow to QuickBooks for payroll."
        actions={
          <>
            <Badge tone={data.settings.quickBooksConnected ? 'success' : 'danger'} dot>
              QuickBooks {data.settings.quickBooksConnected ? 'connected' : 'not connected'}
            </Badge>
            <Button
              onClick={() => {
                const n = actions.syncQuickBooks();
                toast(n ? { title: `${n} timesheet day${n === 1 ? '' : 's'} synced to QuickBooks`, description: 'Your accountant sees them under Time Activities.' } : { title: 'Already in sync', tone: 'info' });
              }}
            >
              <RefreshCw /> Sync to QuickBooks
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
            { value: 'last14', label: 'Last 14 days' },
          ]}
        />
        <div className="flex items-center gap-2">
          {myToday && !myToday.clockOut ? (
            <Button
              variant="outline"
              onClick={() => {
                actions.clockOut(currentUser.id);
                toast({ title: 'Clocked out', description: `${currentUser.name} · ${fmtDate(data.today, 'EEE MMM d')}` });
              }}
            >
              <LogOut /> Clock out
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={!!myToday?.clockOut}
              onClick={() => {
                actions.clockIn(currentUser.id);
                toast({ title: 'Clocked in', description: 'Visits will log automatically as you arrive at properties.' });
              }}
            >
              <LogIn /> {myToday?.clockOut ? 'Day closed' : 'Clock in'}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tracked hours" value={totalTracked.toFixed(1)} sub={`${entries.length} timesheet days`} icon={<Timer />} />
        <Stat label="Billable (on-site) hours" value={totalOnSite.toFixed(1)} sub={`${pct(totalTracked ? totalOnSite / totalTracked : 0)} of tracked`} />
        <Stat label="Non-billable" value={pct(nonBillable)} sub={`Target ≤ ${100 - data.settings.billableTargetPct}% (drive, shop, admin)`} />
        <Stat label="Unsynced days" value={unsynced} sub="Waiting for QuickBooks sync" tone={unsynced ? 'accent' : 'default'} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {members.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyState icon={<Timer />} title="No time in this range" />
          </div>
        )}
        {members.map((m) => (
          <MemberCard key={m.id} m={m} entries={entries.filter((e) => e.memberId === m.id)} today={data.today} target={target} tracked={tracked} onSite={onSite} propName={(id) => property(id)?.name ?? id} jobTitle={(id) => job(id)?.title ?? ''} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>By property</CardTitle>
            <CardDescription>On-site hours per property feed job costing. No timesheets to chase.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {byProperty.length === 0 ? (
              <div className="px-5 pb-4">
                <EmptyState title="No visits in range" />
              </div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Property</TH>
                    <TH className="text-right">Visits</TH>
                    <TH className="text-right">Hours</TH>
                    <TH>Jobs worked</TH>
                    <TH className="text-right">Avg min / visit</TH>
                  </TR>
                </THead>
                <TBody>
                  {byProperty.map(([pid, r]) => (
                    <TR key={pid}>
                      <TD>
                        <div className="font-medium">{property(pid)?.name ?? pid}</div>
                        <div className="text-xs text-muted-foreground">{property(pid)?.city}</div>
                      </TD>
                      <TD className="text-right tabular">{r.visits}</TD>
                      <TD className="text-right tabular">{r.hours.toFixed(1)}</TD>
                      <TD className="max-w-[280px] truncate text-xs text-muted-foreground" title={[...r.jobs].map((id) => job(id)?.title ?? '').join(', ')}>
                        {[...r.jobs]
                          .map((id) => job(id)?.title ?? '')
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(', ')}
                        {r.jobs.size > 3 ? ` +${r.jobs.size - 3}` : ''}
                      </TD>
                      <TD className="text-right tabular">{Math.round((r.hours * 60) / r.visits)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="size-4 text-muted-foreground" /> Geofence settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Field label="Radius (meters)" hint="Bigger for HOAs with multiple entrances.">
              <Input
                type="number"
                min={50}
                max={500}
                step={10}
                value={data.settings.geofenceRadiusM}
                onChange={(e) =>
                  update((d) => {
                    d.settings.geofenceRadiusM = Number(e.target.value);
                  })
                }
                className="w-32 tabular"
              />
            </Field>
            <p>The tablet in the truck or a crew phone entering the radius starts a visit; leaving ends it. Crews never tap a button.</p>
            <p className="text-xs text-muted-foreground">If two jobs are scheduled at the same property that day, the visit is split between them. Pure-mowing days set the mowing baseline used in job costing.</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-success" /> Loaded labor rates from Team: {data.team.map((m) => `${m.name.split(' ')[0]} ${money(m.hourlyCost, { cents: false })}`).join(' · ')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MemberCard({ m, entries, today, target, tracked, onSite, propName, jobTitle }: { m: TeamMember; entries: TimeEntry[]; today: string; target: number; tracked: (t: TimeEntry) => number; onSite: (t: TimeEntry) => number; propName: (id: string) => string; jobTitle: (id: string) => string }) {
  const total = sum(entries.map(tracked));
  const site = sum(entries.map(onSite));
  const ratio = total ? site / total : 0;
  const todayEntry = entries.find((e) => e.date === today);
  const onClock = !!todayEntry && !todayEntry.clockOut;
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={m.name} hue={m.role === 'owner' ? '24 90% 59%' : undefined} />
          <div>
            <div className="flex items-center gap-2 font-semibold">
              {m.name}
              {onClock && (
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <span className="size-2 rounded-full bg-success" /> On the clock
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{titleCase(m.role)}</span>
              <CrewChip crewId={m.crewId} />
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="num text-xl font-semibold">{total.toFixed(1)} h</div>
          <div className="text-xs text-muted-foreground">{site.toFixed(1)} h on site</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">Billable ratio</span>
          <span className={cn('font-semibold tabular', ratio >= target ? 'text-success' : ratio >= target - 0.2 ? 'text-[hsl(30_70%_30%)]' : 'text-destructive')}>
            {pct(ratio)} <span className="font-normal text-muted-foreground">/ {pct(target)} target</span>
          </span>
        </div>
        <Progress value={ratio} tone={ratio >= target ? 'success' : ratio >= target - 0.2 ? 'warning' : 'danger'} />
        {todayEntry && (
          <div className="mt-3 text-xs text-muted-foreground">
            Today: in {fmtTime(todayEntry.clockIn)}
            {todayEntry.clockOut ? ` · out ${fmtTime(todayEntry.clockOut)}` : ' · still out'}
          </div>
        )}
        <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
          {sorted.map((e) => (
            <div key={e.id}>
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>{fmtDate(e.date, 'EEE, MMM d')}</span>
                <span className="flex items-center gap-2">
                  {e.syncedToQuickBooks ? <Badge tone="neutral">Synced</Badge> : e.clockOut ? <Badge tone="outline">Unsynced</Badge> : <Badge tone="outline">Open</Badge>}
                  <span className="tabular">{tracked(e).toFixed(1)} h</span>
                </span>
              </div>
              {e.visits.length === 0 ? (
                <div className="py-1.5 text-xs text-muted-foreground">No property visits (shop / admin / drive)</div>
              ) : (
                <ol className="divide-y divide-border/70">
                  {e.visits.map((v, i) => (
                    <li key={i} className="flex items-center gap-2 py-1.5 text-xs">
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{propName(v.propertyId)}</span>
                        {v.jobIds.length > 0 && <span className="text-muted-foreground"> · {v.jobIds.map(jobTitle).filter(Boolean).join(', ')}</span>}
                      </span>
                      <span className="num whitespace-nowrap text-muted-foreground">
                        {fmtTime(v.arrive)}–{fmtTime(v.depart)}
                      </span>
                      <span className="num w-12 text-right font-medium">{Math.round(hoursBetween(v.arrive, v.depart) * 60)}m</span>
                      {v.source !== 'geofence' && <Badge tone="outline">Manual</Badge>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function weekKey(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function nowHHMM() {
  const t = new Date();
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
