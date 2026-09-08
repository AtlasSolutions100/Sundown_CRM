import { useLocation } from 'wouter';
import { Check, CloudRain, Clock, Droplets, KeyRound, MapPin, Mic, Navigation, Phone, Wrench, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '@/data/store';
import { Button, Card, CardContent, Badge, useToast } from '@/components/ui';
import { useLookups, JobStatusBadge } from '@/components/shared';
import { fmtTime, cn, sum } from '@/lib/utils';
import { estimateMinutes } from '@/lib/pricing';
import { totalMiles, mapsLink } from '@/lib/route';
import type { Job } from '@/data/types';

export default function CrewDay() {
  const { data, actions, currentUser } = useStore();
  const { property, service, client, crew, member } = useLookups();
  const [, navigate] = useLocation();
  const toast = useToast();

  const crewId = currentUser.crewId ?? 'crew_maint';
  const myCrew = crew(crewId);
  const lead = member(myCrew?.leadId);
  const entry = data.timeEntries.find((t) => t.memberId === currentUser.id && t.date === data.today);
  const onClock = !!entry && !entry.clockOut;

  const route = data.jobs
    .filter((j) => j.crewId === crewId && j.scheduledDate === data.today && j.status !== 'unscheduled')
    .sort((a, b) => (a.routeOrder ?? 99) - (b.routeOrder ?? 99));

  const stops = route
    .map((j) => property(j.propertyId))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng }));
  const start = lead ? { lat: lead.homeLat, lng: lead.homeLng } : { lat: currentUser.homeLat, lng: currentUser.homeLng };
  const miles = totalMiles(start, stops);
  const estMin = sum(
    route.map((j) => {
      const s = service(j.serviceId);
      const p = property(j.propertyId);
      return s && p ? estimateMinutes(s, p) : 30;
    }),
  );

  const myPropertyIds = new Set(route.map((j) => j.propertyId));
  const others = data.jobs.filter((j) => j.scheduledDate === data.today && j.crewId && j.crewId !== crewId && myPropertyIds.has(j.propertyId) && j.status !== 'unscheduled');

  const firstName = currentUser.name.split(' ')[0];
  const dateLabel = format(parseISO(data.today), 'EEEE, MMM d');

  function setStatus(j: Job, status: Job['status'], label: string) {
    actions.setJobStatus(j.id, status);
    toast({ title: label, description: property(j.propertyId)?.name });
  }

  function reportIssue(propertyId: string) {
    try {
      sessionStorage.setItem('crew-ticket-property', propertyId);
    } catch {
      /* ignore */
    }
    navigate('/my/ticket');
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {/* Clock card */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dateLabel}</div>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Morning, {firstName}</h1>
          <div className="mt-3">
            {onClock ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/5 p-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-success pulse-ring" />
                  <div>
                    <div className="text-sm font-semibold">On the clock</div>
                    <div className="text-xs text-muted-foreground">since {fmtTime(entry!.clockIn)}</div>
                  </div>
                </div>
                <Button variant="outline" size="md" className="h-11" onClick={() => { actions.clockOut(currentUser.id); toast({ title: 'Clocked out', description: 'Hours will sync to QuickBooks.' }); }}>
                  Clock out
                </Button>
              </div>
            ) : entry?.clockOut ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-semibold">Day complete</div>
                  <div className="text-xs text-muted-foreground">{fmtTime(entry.clockIn)} – {fmtTime(entry.clockOut)}</div>
                </div>
                <Badge tone="success" dot>Clocked out</Badge>
              </div>
            ) : (
              <Button variant="accent" size="lg" className="h-14 w-full text-base" onClick={() => { actions.clockIn(currentUser.id); toast({ title: 'Clocked in', description: 'Have a good one.' }); }}>
                <Clock className="!size-5" /> Clock in
              </Button>
            )}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            Site time is logged automatically by geofence — no need to tap in and out at properties.
          </p>
        </CardContent>
      </Card>

      {/* Route */}
      <div>
        <div className="mb-2 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold">Today's route</h2>
            <div className="text-xs text-muted-foreground">
              {myCrew?.name ?? 'Crew'} · {route.length} stops · {(estMin / 60).toFixed(1)} h est · {miles} mi
            </div>
          </div>
          {stops.length > 0 && (
            <a href={mapsLink(stops)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted">
              <Navigation className="size-3.5" /> Maps
            </a>
          )}
        </div>

        {route.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Nothing on the board for your crew today.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {route.map((j, i) => {
              const p = property(j.propertyId);
              const s = service(j.serviceId);
              const c = client(j.clientId);
              const mins = s && p ? estimateMinutes(s, p) : 30;
              const done = j.status === 'done';
              return (
                <Card key={j.id} className={cn(done && 'opacity-70', j.status === 'in_progress' && 'border-accent shadow-md')}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-base font-bold', done ? 'bg-success text-white' : 'bg-primary text-primary-foreground')}>
                        {done ? <Check className="size-5" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold leading-tight">{p?.name ?? 'Property'}</div>
                            <div className="text-xs text-muted-foreground">{p?.address}, {p?.city}</div>
                          </div>
                          <JobStatusBadge status={j.status} />
                        </div>
                        {!done && (
                          <>
                            <div className="mt-2 text-sm">{j.title}</div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><Clock className="size-3" /> ~{mins} min</span>
                              {c && <span>· {c.name}</span>}
                              {p?.gateCode && (
                                <span className="inline-flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 font-medium text-accent-foreground">
                                  <KeyRound className="size-3" /> Gate {p.gateCode}
                                </span>
                              )}
                            </div>
                            {(p?.notes || j.notes) && (
                              <div className="mt-2 rounded-md bg-muted/60 p-2 text-xs">
                                {p?.notes && <div>{p.notes}</div>}
                                {j.notes && <div className={cn(p?.notes && 'mt-1')}>{j.notes}</div>}
                              </div>
                            )}
                            {(c?.notes) && <div className="mt-1 text-[11px] text-muted-foreground">{c.notes}</div>}
                          </>
                        )}
                      </div>
                    </div>

                    {!done && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {j.status === 'scheduled' && (
                          <>
                            <Button variant="outline" className="h-11" onClick={() => setStatus(j, 'en_route', 'On the way')}>
                              <Navigation /> On my way
                            </Button>
                            <Button variant="primary" className="h-11" onClick={() => setStatus(j, 'in_progress', 'Started')}>
                              Start
                            </Button>
                          </>
                        )}
                        {j.status === 'en_route' && (
                          <Button variant="primary" className="col-span-2 h-11" onClick={() => setStatus(j, 'in_progress', 'Started')}>
                            Start
                          </Button>
                        )}
                        {j.status === 'in_progress' && (
                          <>
                            <Button variant="outline" className="h-11" onClick={() => reportIssue(j.propertyId)}>
                              <AlertTriangle /> Report issue
                            </Button>
                            <Button variant="success" className="h-11" onClick={() => setStatus(j, 'done', 'Marked done')}>
                              <Check /> Done
                            </Button>
                          </>
                        )}
                        {j.status === 'weather_hold' && (
                          <>
                            <div className="col-span-2 flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 p-2 text-xs">
                              <CloudRain className="size-4 text-warning" /> Held for weather. Office will re-suggest a dry day.
                            </div>
                            <Button variant="outline" className="col-span-2 h-11" onClick={() => { actions.weatherHold(j.id, false); toast({ title: 'Released', description: 'Back on the route.' }); }}>
                              Release hold
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Other crews */}
      {others.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-semibold">Also at these properties today</div>
            <div className="mt-2 space-y-2">
              {others.map((j) => {
                const cr = crew(j.crewId);
                return (
                  <div key={j.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{property(j.propertyId)?.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{j.title}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium">
                      <span className="size-2 rounded-full" style={{ background: `hsl(${cr?.color ?? '0 0% 50%'})` }} />
                      {cr?.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={<Mic />} label="Voice ticket" onClick={() => navigate('/my/ticket')} accent />
          <QuickAction icon={<Wrench />} label="Work order" onClick={() => navigate('/my/work-order')} />
          <QuickAction icon={<Droplets />} label="Backflow test" onClick={() => navigate('/my/backflow')} />
          <a href={`tel:${data.settings.phone.replace(/\D/g, '')}`} className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-lg border bg-card text-sm font-medium shadow-sm hover:bg-muted [&_svg]:size-6 [&_svg]:text-primary">
            <Phone /> Call office
          </a>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick, accent }: { icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-20 flex-col items-center justify-center gap-1.5 rounded-lg border text-sm font-medium shadow-sm [&_svg]:size-6',
        accent ? 'border-accent bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-card hover:bg-muted [&_svg]:text-primary',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
