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
    <div className="space-y-5 px-4 py-4">
      {/* Greeting + clock */}
      <div>
        <div className="text-xs font-medium text-muted-foreground">{dateLabel}</div>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Morning, {firstName}</h1>
        <div className="mt-3">
          {onClock ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="size-2 rounded-full bg-success live-dot" />
                <span className="font-medium">On the clock</span>
                <span className="text-muted-foreground">since {fmtTime(entry!.clockIn)}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => { actions.clockOut(currentUser.id); toast({ title: 'Clocked out', description: 'Hours will sync to QuickBooks.' }); }}>
                Clock out
              </Button>
            </div>
          ) : entry?.clockOut ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <span className="font-medium">Day complete</span>
                <span className="text-muted-foreground"> · {fmtTime(entry.clockIn)} – {fmtTime(entry.clockOut)}</span>
              </div>
              <Badge tone="neutral">Clocked out</Badge>
            </div>
          ) : (
            <Button variant="primary" size="lg" className="w-full" onClick={() => { actions.clockIn(currentUser.id); toast({ title: 'Clocked in', description: 'Have a good one.' }); }}>
              <Clock /> Clock in
            </Button>
          )}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          Site time is logged by geofence. No tapping in or out at properties.
        </p>
      </div>

      {/* Route */}
      <div>
        <div className="mb-2 flex items-end justify-between">
          <div>
            <h2 className="text-[15px] font-semibold">Today's route</h2>
            <div className="text-xs text-muted-foreground">
              {myCrew?.name ?? 'Crew'} · {route.length} stops · {(estMin / 60).toFixed(1)} h est · {miles} mi
            </div>
          </div>
          {stops.length > 0 && (
            <a href={mapsLink(stops)} target="_blank" rel="noreferrer" className="control-shadow inline-flex h-8 items-center gap-1.5 rounded-md bg-card px-3 text-[13px] font-medium hover:bg-muted/60">
              <Navigation className="size-3.5 text-muted-foreground" /> Maps
            </a>
          )}
        </div>

        {route.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Nothing on the board for your crew today.</CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {route.map((j, i) => {
              const p = property(j.propertyId);
              const s = service(j.serviceId);
              const c = client(j.clientId);
              const mins = s && p ? estimateMinutes(s, p) : 30;
              const done = j.status === 'done';
              if (done) {
                return (
                  <div key={j.id} className="flex items-center gap-3 px-1 py-1.5 text-sm text-muted-foreground">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
                      <Check className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p?.name ?? 'Property'}</span>
                    <span className="text-xs">Done</span>
                  </div>
                );
              }
              return (
                <Card key={j.id} className={cn(j.status === 'in_progress' && 'ring-1 ring-accent/50')}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-semibold leading-tight">{p?.name ?? 'Property'}</div>
                            <div className="text-xs text-muted-foreground">{p?.address}, {p?.city}</div>
                          </div>
                          <JobStatusBadge status={j.status} />
                        </div>
                        <div className="mt-2 text-sm">{j.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock className="size-3" /> ~{mins} min</span>
                          {c && <span>{c.name}</span>}
                          {p?.gateCode && (
                            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                              <KeyRound className="size-3" /> Gate {p.gateCode}
                            </span>
                          )}
                        </div>
                        {(p?.notes || j.notes) && (
                          <div className="mt-2 rounded-lg bg-muted/50 p-2.5 text-xs">
                            {p?.notes && <div>{p.notes}</div>}
                            {j.notes && <div className={cn(p?.notes && 'mt-1')}>{j.notes}</div>}
                          </div>
                        )}
                        {(c?.notes) && <div className="mt-1 text-[11px] text-muted-foreground">{c.notes}</div>}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {j.status === 'scheduled' && (
                        <>
                          <Button variant="outline" size="lg" onClick={() => setStatus(j, 'en_route', 'On the way')}>
                            <Navigation /> On my way
                          </Button>
                          <Button variant="primary" size="lg" onClick={() => setStatus(j, 'in_progress', 'Started')}>
                            Start
                          </Button>
                        </>
                      )}
                      {j.status === 'en_route' && (
                        <Button variant="primary" size="lg" className="col-span-2" onClick={() => setStatus(j, 'in_progress', 'Started')}>
                          Start
                        </Button>
                      )}
                      {j.status === 'in_progress' && (
                        <>
                          <Button variant="outline" size="lg" onClick={() => reportIssue(j.propertyId)}>
                            <AlertTriangle /> Report issue
                          </Button>
                          <Button variant="success" size="lg" onClick={() => setStatus(j, 'done', 'Marked done')}>
                            <Check /> Done
                          </Button>
                        </>
                      )}
                      {j.status === 'weather_hold' && (
                        <>
                          <div className="col-span-2 flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-xs">
                            <CloudRain className="size-4 text-muted-foreground" /> Held for weather. Office will re-suggest a dry day.
                          </div>
                          <Button variant="outline" size="lg" className="col-span-2" onClick={() => { actions.weatherHold(j.id, false); toast({ title: 'Released', description: 'Back on the route.' }); }}>
                            Release hold
                          </Button>
                        </>
                      )}
                    </div>
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
            <div className="mt-1 divide-y divide-border/70">
              {others.map((j) => {
                const cr = crew(j.crewId);
                return (
                  <div key={j.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
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
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={<Mic />} label="Voice ticket" onClick={() => navigate('/my/ticket')} />
          <QuickAction icon={<Wrench />} label="Work order" onClick={() => navigate('/my/work-order')} />
          <QuickAction icon={<Droplets />} label="Backflow test" onClick={() => navigate('/my/backflow')} />
          <a href={`tel:${data.settings.phone.replace(/\D/g, '')}`} className="control-shadow flex h-16 flex-col items-center justify-center gap-1 rounded-lg bg-card text-[13px] font-medium hover:bg-muted/60 [&_svg]:size-5 [&_svg]:text-muted-foreground">
            <Phone /> Call office
          </a>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="control-shadow flex h-16 flex-col items-center justify-center gap-1 rounded-lg bg-card text-[13px] font-medium hover:bg-muted/60 [&_svg]:size-5 [&_svg]:text-muted-foreground"
    >
      {icon}
      {label}
    </button>
  );
}
