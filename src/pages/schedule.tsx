import { useMemo, useState } from 'react';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Route as RouteIcon, ExternalLink, Zap, Play, Check, CloudSun, X, CalendarRange } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Select, Segmented, PageHeader, EmptyState, useToast } from '@/components/ui';
import { useLookups, JobStatusBadge, DivisionBadge } from '@/components/shared';
import { estimateMinutes } from '@/lib/pricing';
import { optimizeRoute, totalMiles, mapsLink, type Stop } from '@/lib/route';
import { money, addDaysIso, daysBetween, fmtDate, cn, sum } from '@/lib/utils';
import type { Crew, Job } from '@/data/types';

const ACTIVE: Job['status'][] = ['scheduled', 'en_route', 'in_progress', 'done', 'weather_hold'];

export default function Schedule() {
  const { data, actions } = useStore();
  const { property, service, member, crew: crewOf } = useLookups();
  const toast = useToast();

  const [date, setDate] = useState(data.today);
  const [crewSel, setCrewSel] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dispatchDate, setDispatchDate] = useState(data.today);
  const [dispatchCrew, setDispatchCrew] = useState(data.crews[0]?.id ?? '');

  const crews = crewSel === 'all' ? data.crews : data.crews.filter((c) => c.id === crewSel);

  // Week strip (Mon–Fri)
  const weekStart = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  const jobsFor = (crewId: string, d: string) => data.jobs.filter((j) => j.crewId === crewId && j.scheduledDate === d && ACTIVE.includes(j.status)).sort((a, b) => (a.routeOrder ?? 99) - (b.routeOrder ?? 99));

  const stopsFor = (jobs: Job[]): Stop[] =>
    jobs
      .map((j) => {
        const p = property(j.propertyId);
        return p ? { id: j.id, lat: p.lat, lng: p.lng } : null;
      })
      .filter((s): s is Stop => !!s);

  const startFor = (c: Crew) => {
    const lead = member(c.leadId);
    return { lat: lead?.homeLat ?? 47.71, lng: lead?.homeLng ?? -116.95 };
  };

  const optimize = (c: Crew, d: string) => {
    const jobs = jobsFor(c.id, d);
    const pending = jobs.filter((j) => j.status !== 'done');
    const doneIds = jobs.filter((j) => j.status === 'done').map((j) => j.id);
    const start = startFor(c);
    const before = totalMiles(start, stopsFor(jobs));
    const ordered = optimizeRoute(start, stopsFor(pending));
    const newOrder = [...doneIds, ...ordered.map((s) => s.id)];
    actions.setRouteOrder(d, c.id, newOrder);
    const after = totalMiles(start, stopsFor([...jobs.filter((j) => j.status === 'done'), ...ordered.map((s) => pending.find((j) => j.id === s.id)!)]));
    toast({ title: `${c.name} route optimized`, description: `${before} mi → ${after} mi (${jobs.length} stops)` });
  };

  const move = (c: Crew, d: string, jobId: string, dir: -1 | 1) => {
    const ids = jobsFor(c.id, d).map((j) => j.id);
    const i = ids.indexOf(jobId);
    const k = i + dir;
    if (i < 0 || k < 0 || k >= ids.length) return;
    [ids[i], ids[k]] = [ids[k], ids[i]];
    actions.setRouteOrder(d, c.id, ids);
  };

  // Waiting list
  const horizon = addDaysIso(date, 14);
  const waiting = useMemo(() => {
    const urgentTicketJobIds = new Set(data.tickets.filter((t) => t.priority === 'urgent' && t.jobId).map((t) => t.jobId!));
    return data.jobs
      .filter((j) => j.status === 'unscheduled' && (j.windowStart <= horizon || j.urgent || urgentTicketJobIds.has(j.id) || j.windowEnd < data.today))
      .map((j) => {
        const behindDays = j.windowEnd < data.today ? daysBetween(j.windowEnd, data.today) : 0;
        const urgent = !!j.urgent || urgentTicketJobIds.has(j.id);
        const bucket = urgent ? 0 : behindDays > 0 ? 1 : j.windowStart <= data.today ? 2 : 3;
        return { j, behindDays, urgent, bucket };
      })
      .sort((a, b) => a.bucket - b.bucket || b.behindDays - a.behindDays || a.j.windowStart.localeCompare(b.j.windowStart));
  }, [data.jobs, data.tickets, data.today, horizon]);

  const urgentUnscheduled = waiting.filter((w) => w.urgent);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const dispatch = () => {
    const ids = [...selected];
    ids.forEach((id) => actions.scheduleJob(id, dispatchDate, dispatchCrew));
    setSelected(new Set());
    toast({ title: `${ids.length} job${ids.length === 1 ? '' : 's'} dispatched`, description: `${fmtDate(dispatchDate)} · ${crewOf(dispatchCrew)?.name}` });
    setDate(dispatchDate);
  };

  const addUrgentAndReroute = (j: Job) => {
    const c = data.crews.find((c) => c.division === j.division) ?? data.crews[0];
    actions.scheduleJob(j.id, date, c.id);
    // optimize with the new stop included
    const existing = jobsFor(c.id, date).filter((x) => x.status !== 'done');
    const doneIds = jobsFor(c.id, date).filter((x) => x.status === 'done').map((x) => x.id);
    const p = property(j.propertyId);
    const stops = [...stopsFor(existing), ...(p ? [{ id: j.id, lat: p.lat, lng: p.lng }] : [])];
    const ordered = optimizeRoute(startFor(c), stops);
    actions.setRouteOrder(date, c.id, [...doneIds, ...ordered.map((s) => s.id)]);
    toast({ title: 'Added & re-routed', description: `${j.title} inserted into ${c.name}'s ${fmtDate(date)} route.`, tone: 'info' });
  };

  return (
    <div>
      <PageHeader
       
        title="Schedule & Routes"
        subtitle="Each crew sees only its own route. Add a stop and the route rebuilds."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setDate(addDaysIso(date, -1))} aria-label="Previous day"><ChevronLeft /></Button>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            <Button variant="outline" size="icon" onClick={() => setDate(addDaysIso(date, 1))} aria-label="Next day"><ChevronRight /></Button>
            <Button variant="ghost" size="sm" onClick={() => setDate(data.today)}>Today</Button>
            <Segmented value={crewSel} onChange={setCrewSel} options={[{ value: 'all', label: 'All crews' }, ...data.crews.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
        }
      />

      {/* Week strip */}
      <div className="grid grid-cols-5 gap-2">
        {weekDays.map((d) => {
          const isSel = d === date;
          const isToday = d === data.today;
          return (
            <button key={d} type="button" onClick={() => setDate(d)} className={cn('surface p-2.5 text-left transition-colors hover:bg-muted/40', isSel && 'bg-foreground/[0.06] hover:bg-foreground/[0.06]')}>
              <div className="flex items-center justify-between text-xs">
                <span className={cn('font-medium', isToday && 'text-accent')}>{format(parseISO(d), 'EEE')}</span>
                <span className="num text-muted-foreground">{format(parseISO(d), 'M/d')}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {data.crews.map((c) => {
                  const n = jobsFor(c.id, d).length;
                  if (!n) return null;
                  return (
                    <span key={c.id} className="num inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={`${c.name}: ${n} jobs`}>
                      <span className="size-1.5 rounded-full" style={{ background: `hsl(${c.color})` }} />{n}
                    </span>
                  );
                })}
                {data.crews.every((c) => jobsFor(c.id, d).length === 0) && <span className="text-[10px] text-muted-foreground">—</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {crews.map((c) => {
            const jobs = jobsFor(c.id, date);
            const stops = stopsFor(jobs);
            const miles = totalMiles(startFor(c), stops);
            const minutes = sum(jobs.map((j) => { const s = service(j.serviceId); const p = property(j.propertyId); return s && p ? estimateMinutes(s, p) : 30; }));
            return (
              <Card key={c.id}>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: `hsl(${c.color})` }} />
                      {c.name}
                      <span className="text-sm font-normal text-muted-foreground">· {format(parseISO(date), 'EEE, MMM d')}</span>
                    </CardTitle>
                    <CardDescription>
                      {jobs.length} stop{jobs.length === 1 ? '' : 's'} · ~{(minutes / 60).toFixed(1)} h on site · {miles} mi from {member(c.leadId)?.name.split(' ')[0]}'s start · {money(sum(jobs.map((j) => j.price)), { cents: false })} booked
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={jobs.length < 2} onClick={() => optimize(c, date)}><RouteIcon /> Optimize route</Button>
                    <a href={mapsLink(stops)} target="_blank" rel="noreferrer" className={cn('inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted', !stops.length && 'pointer-events-none opacity-50')}>
                      <ExternalLink className="size-4" /> Google Maps
                    </a>
                  </div>
                </CardHeader>
                <CardContent>
                  {jobs.length === 0 ? (
                    <EmptyState icon={<CalendarRange />} title="Nothing scheduled" description="Dispatch from the waiting list on the right." />
                  ) : (
                    <ol className="divide-y">
                      {jobs.map((j, i) => {
                        const p = property(j.propertyId);
                        const s = service(j.serviceId);
                        const mins = s && p ? estimateMinutes(s, p) : 30;
                        return (
                          <li key={j.id} className={cn('flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center', j.status === 'weather_hold' && 'opacity-70')}>
                            <div className="flex flex-col">
                              <button type="button" disabled={i === 0} onClick={() => move(c, date, j.id, -1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move up"><ArrowUp className="size-3.5" /></button>
                              <span className="text-center text-xs font-bold tabular">{i + 1}</span>
                              <button type="button" disabled={i === jobs.length - 1} onClick={() => move(c, date, j.id, 1)} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move down"><ArrowDown className="size-3.5" /></button>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{p?.name ?? '—'}</span>
                                {j.urgent && <Badge tone="danger" dot>Urgent</Badge>}
                                <JobStatusBadge status={j.status} />
                              </div>
                              <div className="text-xs text-muted-foreground">{p?.address}, {p?.city} · {j.title} · ~{mins} min</div>
                            </div>
                            <div className="flex items-center gap-2 sm:justify-end">
                              <span className="num w-20 text-right text-sm font-medium">{money(j.price)}</span>
                              {j.status === 'scheduled' && <Button size="sm" variant="outline" onClick={() => { actions.setJobStatus(j.id, 'in_progress'); toast({ title: 'Started', description: p?.name }); }}><Play /> Start</Button>}
                              {(j.status === 'in_progress' || j.status === 'en_route') && <Button size="sm" variant="outline" onClick={() => { actions.setJobStatus(j.id, 'done'); toast({ title: 'Done', description: `${p?.name} · ${j.title}` }); }}><Check /> Done</Button>}
                              {j.status === 'weather_hold' && <Button size="sm" variant="outline" onClick={() => { actions.weatherHold(j.id, false); toast({ title: 'Released from weather hold' }); }}><CloudSun /> Release</Button>}
                              {j.status !== 'done' && <Button size="xs" variant="ghost" onClick={() => { actions.unscheduleJob(j.id); toast({ title: 'Back to waiting list', description: j.title, tone: 'info' }); }} aria-label="Unschedule"><X /></Button>}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Waiting list */}
        <div className="space-y-4">
          {urgentUnscheduled.length > 0 && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2"><Zap className="size-4 text-destructive" /> Urgent, not on a schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="-mx-5 divide-y divide-border/70">
                  {urgentUnscheduled.map(({ j }) => (
                    <div key={j.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{j.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{property(j.propertyId)?.name}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => addUrgentAndReroute(j)}>Add to {date === data.today ? 'today' : fmtDate(date)} & re-route</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Waiting list</CardTitle>
              <CardDescription>Unscheduled work due through {fmtDate(horizon)} — behind first.</CardDescription>
            </CardHeader>
            <CardContent>
              {waiting.length === 0 ? (
                <EmptyState title="Waiting list is empty" />
              ) : (
                <div className="-mx-5 max-h-[520px] divide-y divide-border/70 overflow-y-auto scrollbar-thin">
                  {waiting.map(({ j, behindDays, urgent }) => (
                    <label key={j.id} className={cn('flex cursor-pointer items-start gap-2.5 px-5 py-2.5 text-sm transition-colors hover:bg-muted/40', selected.has(j.id) && 'bg-foreground/[0.05]')}>
                      <input type="checkbox" checked={selected.has(j.id)} onChange={() => toggle(j.id)} className="mt-1 size-4 accent-[hsl(var(--primary))]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate font-medium">{property(j.propertyId)?.name}</span>
                          {urgent && <Badge tone="danger" dot>Urgent</Badge>}
                          {!urgent && behindDays > 0 && <Badge tone="danger" dot>{behindDays}d behind</Badge>}
                          {!urgent && behindDays === 0 && j.windowStart <= data.today && <Badge tone="warning" dot>Due now</Badge>}
                          {!urgent && behindDays === 0 && j.windowStart > data.today && <Badge tone="outline">Opens {fmtDate(j.windowStart)}</Badge>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{j.title} · window {fmtDate(j.windowStart)}–{fmtDate(j.windowEnd)}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <DivisionBadge division={j.division} />
                          <span className="text-xs tabular text-muted-foreground">{money(j.price)}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
                  <Select value={dispatchCrew} onChange={(e) => setDispatchCrew(e.target.value)}>
                    {data.crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <Button className="w-full" disabled={selected.size === 0} onClick={dispatch}>
                  Dispatch selected ({selected.size})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
