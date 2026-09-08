import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Mic, MapPin, CheckCircle2, Sparkles } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardContent, Badge, Select, Textarea, Field, Segmented, Switch, useToast } from '@/components/ui';
import { TicketStageBadge } from '@/components/shared';
import { cn, fmtDateTime } from '@/lib/utils';
import type { Division, Ticket } from '@/data/types';

const SAMPLES = [
  'Job ticket for Camden Place, sprinkler head broken by the mailbox kiosk',
  'Ticket for Mill River, dog park gate latch is broken',
  'Riverstone, zone 7 rotor stuck spraying the sidewalk',
];

const MAINT_WORDS = /\b(mow|mowing|prune|pruning|tree|limb|leaf|leaves|weed|weeds|gate|latch|fence)\b/i;
const IRR_WORDS = /\b(sprinkler|head|rotor|zone|leak|leaking|drip|valve|controller|geyser|geysering|spray|spraying)\b/i;

export default function CrewTicket() {
  const { data, actions, currentUser } = useStore();
  const [, navigate] = useLocation();
  const toast = useToast();

  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [usedMic, setUsedMic] = useState(false);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [propertyId, setPropertyId] = useState<string>('');
  const [manualProperty, setManualProperty] = useState(false);
  const [division, setDivision] = useState<Division>('irrigation');
  const [manualDivision, setManualDivision] = useState(false);
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [needsBid, setNeedsBid] = useState(false);
  const [created, setCreated] = useState<Ticket | undefined>();

  // Preselect a property handed over from My Day.
  useEffect(() => {
    try {
      const pid = sessionStorage.getItem('crew-ticket-property');
      if (pid) {
        setPropertyId(pid);
        setManualProperty(true);
        sessionStorage.removeItem('crew-ticket-property');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const matched = useMemo(() => {
    const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    if (!words.length) return undefined;
    let best: { id: string; score: number } | undefined;
    for (const p of data.properties) {
      const c = data.clients.find((c) => c.id === p.clientId);
      const hay = `${p.name} ${c?.name ?? ''}`.toLowerCase();
      const score = words.filter((w) => hay.includes(w)).length;
      if (score > 0 && (!best || score > best.score)) best = { id: p.id, score };
    }
    return best?.id;
  }, [text, data.properties, data.clients]);

  useEffect(() => {
    if (!manualProperty && matched) setPropertyId(matched);
  }, [matched, manualProperty]);

  useEffect(() => {
    if (manualDivision) return;
    if (MAINT_WORDS.test(text) && !IRR_WORDS.test(text)) setDivision('maintenance');
    else if (IRR_WORDS.test(text)) setDivision('irrigation');
  }, [text, manualDivision]);

  const title = useMemo(() => {
    const comma = text.indexOf(',');
    const raw = (comma >= 0 ? text.slice(comma + 1) : text).trim();
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
  }, [text]);

  const property = data.properties.find((p) => p.id === propertyId);
  const propClient = data.clients.find((c) => c.id === property?.clientId);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof data.properties>();
    for (const p of data.properties) {
      const c = data.clients.find((c) => c.id === p.clientId);
      const key = c?.name ?? 'Other';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.properties, data.clients]);

  function tapMic() {
    if (listening) return;
    setListening(true);
    window.setTimeout(() => {
      setText(SAMPLES[sampleIdx % SAMPLES.length]);
      setSampleIdx((i) => i + 1);
      setUsedMic(true);
      setManualProperty(false);
      setManualDivision(false);
      setListening(false);
    }, 1500);
  }

  function submit() {
    if (!property || !title) return;
    const t = actions.createTicket({
      title,
      description: text,
      source: usedMic ? 'voice' : 'field',
      priority,
      clientId: property.clientId,
      propertyId: property.id,
      division,
      needsBid,
    });
    setCreated(t);
    toast({ title: `Ticket #${t?.number ?? ''} sent`, description: property.name });
  }

  function resetForm() {
    setText('');
    setUsedMic(false);
    setPropertyId('');
    setManualProperty(false);
    setManualDivision(false);
    setDivision('irrigation');
    setPriority('normal');
    setNeedsBid(false);
    setCreated(undefined);
  }

  const mine = data.tickets.filter((t) => t.createdBy === currentUser.id).slice(0, 5);

  if (created) {
    const p = data.properties.find((p) => p.id === created.propertyId);
    return (
      <div className="space-y-4 px-4 py-4">
        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-5 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <h1 className="mt-3 text-xl font-bold">Ticket #{created.number} sent to the office</h1>
            <p className="mt-1 text-sm text-muted-foreground">David and the ops board see it now.</p>
            <div className="mt-4 rounded-lg border bg-card p-3 text-left text-sm">
              <div className="font-semibold">{created.title}</div>
              <div className="text-xs text-muted-foreground">{p?.name} · {p?.address}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="outline">{created.source === 'voice' ? 'Voice' : 'Field'}</Badge>
                <Badge tone={created.division === 'maintenance' ? 'success' : 'info'}>{created.division}</Badge>
                {created.priority === 'urgent' && <Badge tone="danger" dot>Urgent</Badge>}
                {created.needsBid && <Badge tone="warning">Needs bid</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={resetForm}>New ticket</Button>
          <Button variant="primary" className="h-12" onClick={() => navigate('/my/day')}>Back to My Day</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quick ticket</h1>
        <p className="text-sm text-muted-foreground">Say it from the truck. The office gets a ticket on the right property.</p>
      </div>

      <div className="flex flex-col items-center py-2">
        <button
          type="button"
          onClick={tapMic}
          className={cn(
            'flex size-24 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform active:scale-95',
            listening && 'pulse-ring',
          )}
          aria-label="Dictate ticket"
        >
          <Mic className="size-10" strokeWidth={2.2} />
        </button>
        <div className="mt-2 text-sm font-semibold">{listening ? 'Listening…' : 'Tap to dictate'}</div>
        <div className="text-[11px] text-muted-foreground">Simulated voice input for this prototype</div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setUsedMic(false);
        }}
        placeholder='e.g. "Job ticket for Camden Place, sprinkler head broken by the mailbox"'
        className="min-h-[96px] text-base"
      />

      {text.trim() && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3.5 text-accent" /> Parsed
            </div>

            <div>
              <div className={cn('flex items-center gap-2 rounded-md border p-2.5 text-sm', property ? 'border-success/40 bg-success/5' : 'border-warning/50 bg-warning/10')}>
                <MapPin className={cn('size-4 shrink-0', property ? 'text-success' : 'text-warning')} />
                {property ? (
                  <span>
                    Matched: <span className="font-semibold">{property.name}</span>
                    {propClient && <span className="text-muted-foreground"> · {propClient.name}</span>}
                  </span>
                ) : (
                  <span>No property matched — pick one below.</span>
                )}
              </div>
              <Select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setManualProperty(true);
                }}
                className="mt-2 h-11"
              >
                <option value="">Choose property…</option>
                {grouped.map(([clientName, props]) => (
                  <optgroup key={clientName} label={clientName}>
                    {props.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>

            <Field label="Title">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{title || <span className="text-muted-foreground">—</span>}</div>
            </Field>

            <Field label="Division">
              <Select
                value={division}
                onChange={(e) => {
                  setDivision(e.target.value as Division);
                  setManualDivision(true);
                }}
                className="h-11"
              >
                <option value="irrigation">Irrigation</option>
                <option value="maintenance">Maintenance</option>
                <option value="installs">Installs</option>
                <option value="backflow">Backflow</option>
              </Select>
            </Field>

            <div className="flex items-center justify-between gap-3">
              <Segmented value={priority} onChange={setPriority} options={[{ value: 'normal', label: 'Normal' }, { value: 'urgent', label: 'Urgent' }]} />
              <Switch checked={needsBid} onChange={setNeedsBid} label="Needs a bid?" />
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="accent" className="h-12 w-full text-base" disabled={!property || !title} onClick={submit}>
        Send ticket to office
      </Button>

      {mine.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your recent tickets</h2>
          <div className="divide-y rounded-lg border bg-card">
            {mine.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">#{t.number} {t.title}</div>
                  <div className="text-xs text-muted-foreground">{data.properties.find((p) => p.id === t.propertyId)?.name} · {fmtDateTime(t.createdAt)}</div>
                </div>
                <TicketStageBadge stage={t.stage} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
