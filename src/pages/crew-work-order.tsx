import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Minus, Plus, Search, CheckCircle2, Wrench } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardContent, Input, Select, Textarea, Field, useToast } from '@/components/ui';
import { money, cn, sum, hhmmToMinutes, fmtTime } from '@/lib/utils';
import { partSellPrice, round2 } from '@/lib/pricing';

const TRIP_FEE = 45;
const LABOR_RATE = 85;

export default function CrewWorkOrder() {
  const { data, actions, currentUser } = useStore();
  const [, navigate] = useLocation();
  const toast = useToast();

  const crewId = currentUser.crewId ?? 'crew_maint';
  const activeJob = data.jobs.find((j) => j.crewId === crewId && j.scheduledDate === data.today && j.status === 'in_progress');
  const todayEntry = data.timeEntries.find((t) => t.memberId === currentUser.id && t.date === data.today);
  const activeVisit = activeJob ? todayEntry?.visits.find((v) => v.propertyId === activeJob.propertyId) : undefined;

  const [propertyId, setPropertyId] = useState(activeJob?.propertyId ?? data.properties[0]?.id ?? '');
  const [jobId, setJobId] = useState(activeJob?.id ?? '');
  const [timeIn, setTimeIn] = useState(activeVisit ? activeVisit.arrive.slice(11, 16) : '08:00');
  const [timeOut, setTimeOut] = useState('10:15');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [work, setWork] = useState('');
  const [result, setResult] = useState<{ total: number; number: number } | undefined>();

  const property = data.properties.find((p) => p.id === propertyId);
  const client = data.clients.find((c) => c.id === property?.clientId);
  const propJobs = data.jobs.filter((j) => j.propertyId === propertyId && j.status !== 'done' && j.status !== 'skipped');
  const job = data.jobs.find((j) => j.id === jobId);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof data.properties>();
    for (const p of data.properties) {
      const c = data.clients.find((c) => c.id === p.clientId);
      const key = c?.name ?? 'Other';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.properties, data.clients]);

  const partsByCat = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.parts.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    const map = new Map<string, typeof data.parts>();
    for (const p of list) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map.entries()];
  }, [data.parts, search]);

  const minutes = Math.max(0, hhmmToMinutes(timeOut) - hhmmToMinutes(timeIn));
  const hours = round2(minutes / 60);
  const selected = Object.entries(qty).filter(([, n]) => n > 0).map(([partId, n]) => ({ partId, qty: n }));
  const partsTotal = sum(selected.map((s) => partSellPrice(data.parts.find((p) => p.id === s.partId)!) * s.qty));
  const laborTotal = round2(hours * LABOR_RATE);
  const total = round2(TRIP_FEE + laborTotal + partsTotal);

  function step(partId: string, delta: number) {
    setQty((q) => ({ ...q, [partId]: Math.max(0, (q[partId] ?? 0) + delta) }));
  }

  function submit() {
    if (!property || !client) return;
    const nextNumber = data.counters.workOrder;
    actions.submitWorkOrder({
      jobId: job?.id,
      ticketId: job?.ticketId,
      propertyId: property.id,
      clientId: client.id,
      date: data.today,
      techId: currentUser.id,
      timeIn,
      timeOut,
      laborRate: LABOR_RATE,
      parts: selected,
      workPerformed: work,
    });
    setResult({ total, number: nextNumber });
    toast({ title: `Work order #${nextNumber} submitted`, description: 'Invoice drafted for approval.' });
  }

  function reset() {
    setQty({});
    setWork('');
    setSearch('');
    setResult(undefined);
    setJobId('');
  }

  if (result) {
    return (
      <div className="space-y-4 px-4 py-4">
        <Card>
          <CardContent className="p-5 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <h1 className="mt-3 text-xl font-semibold">Work order #{result.number} submitted</h1>
            <p className="mt-1 text-sm text-muted-foreground">Invoice drafted for David's approval: <span className="num font-semibold text-foreground">{money(result.total)}</span></p>
            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-left text-sm">
              <div className="font-semibold">{property?.name}</div>
              <div className="text-xs text-muted-foreground">{client?.name} · <span className="font-mono text-[12px]">{timeIn}–{timeOut}</span> · {hours} h · {selected.length} part lines</div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={reset}>Another</Button>
          <Button variant="primary" size="lg" onClick={() => navigate('/my/day')}>My day</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Work order</h1>
        <p className="text-sm text-muted-foreground">Property, time, parts from the bucket. Priced automatically.</p>
        <div className="mt-1 text-xs text-muted-foreground">Tech <span className="font-medium text-foreground">{currentUser.name}</span> · {data.today}</div>
      </div>

      <div className="space-y-4">
        {/* 1 Property */}
        <Section n={1} title="Property">
          <Select value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setJobId(''); }} className="h-11">
            {grouped.map(([clientName, props]) => (
              <optgroup key={clientName} label={clientName}>
                {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </Select>
          {property && <div className="mt-1 text-xs text-muted-foreground">{property.address}, {property.city}</div>}
          <Field label="Linked job" className="mt-3">
            <Select value={jobId} onChange={(e) => setJobId(e.target.value)} className="h-11">
              <option value="">No linked job</option>
              {propJobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.scheduledDate ? ` · ${j.scheduledDate}` : ''}</option>)}
            </Select>
          </Field>
        </Section>

        {/* 2 Time */}
        <Section n={2} title="Time">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Time in"><Input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} className="h-11 text-base" /></Field>
            <Field label="Time out"><Input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} className="h-11 text-base" /></Field>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{activeVisit ? `Geofence arrival ${fmtTime(activeVisit.arrive)}` : 'Labor'}</span>
            <span className="num font-medium">{hours} h × {money(LABOR_RATE)} = {money(laborTotal)}</span>
          </div>
        </Section>

        {/* 3 Parts */}
        <Section n={3} title="Parts — count the bucket">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parts…" className="h-11 pl-9" />
          </div>
          <div className="mt-3 max-h-[380px] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {partsByCat.map(([cat, list]) => (
              <div key={cat}>
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">{cat}</div>
                <div className="divide-y divide-border/70">
                  {list.map((p) => {
                    const n = qty[p.id] ?? 0;
                    return (
                      <div key={p.id} className={cn('flex items-center gap-2 py-2', n > 0 && '-mx-2 rounded-lg bg-muted/50 px-2')}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{p.name}</div>
                          <div className="num text-xs text-muted-foreground">{money(partSellPrice(p))} / {p.unit}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => step(p.id, -1)} className="control-shadow flex size-10 items-center justify-center rounded-lg bg-card text-foreground active:bg-muted disabled:opacity-40" disabled={n === 0} aria-label="Less">
                            <Minus className="size-4" />
                          </button>
                          <span className={cn('num w-8 text-center text-base font-semibold', n === 0 && 'text-muted-foreground')}>{n}</span>
                          <button type="button" onClick={() => step(p.id, 1)} className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground active:bg-primary/80" aria-label="More">
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Prices come from the SiteOne list with your markup — you never type a price.</p>
        </Section>

        {/* 4 Work performed */}
        <Section n={4} title="Work performed">
          <Textarea value={work} onChange={(e) => setWork(e.target.value)} placeholder="What you found, what you did, what to watch." className="min-h-[90px] text-base" />
        </Section>
      </div>

      {/* Sticky total + submit */}
      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-border/70 bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="num">Trip {money(TRIP_FEE)} · Labor {money(laborTotal)} · Parts {money(partsTotal)} ({selected.length})</span>
          <span className="num text-base font-semibold text-foreground">{money(total)}</span>
        </div>
        <Button variant="primary" size="lg" className="w-full" disabled={!property || minutes <= 0} onClick={submit}>
          <Wrench /> Submit work order
        </Button>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="num text-xs font-medium text-muted-foreground">{String(n).padStart(2, '0')}</span>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
