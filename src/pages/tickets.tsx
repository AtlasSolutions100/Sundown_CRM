import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Plus, Mic, Wand2, Ticket as TicketIcon, Receipt } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardContent, Badge, Input, Select, Textarea, Field, Dialog, Segmented, Table, THead, TBody, TR, TH, TD, PageHeader, EmptyState, Pipeline, Avatar, useToast } from '@/components/ui';
import { useLookups, TicketStageBadge, STAGES, ticketPipeline, DivisionBadge, PriorityBadge, SourceIcon, ClientLink, PropertyLabel } from '@/components/shared';
import { fmtDateTime, fmtDate, cn } from '@/lib/utils';
import type { Ticket, TicketSource, Division } from '@/data/types';

function ageLabel(createdAt: string, today: string) {
  const created = new Date(createdAt).getTime();
  const now = new Date(`${today}T${new Date().toTimeString().slice(0, 8)}`).getTime();
  const mins = Math.max(0, Math.round((now - created) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function Tickets() {
  const { data } = useStore();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const openTicket = openId ? data.tickets.find((t) => t.id === openId) : undefined;
  const boardStages = STAGES.filter((s) => s.value !== 'closed');
  const sorted = useMemo(() => [...data.tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data.tickets]);

  return (
    <div>
      <PageHeader
        eyebrow="Non-routine work"
        title="Service Requests"
        subtitle="Every call, text, email, web form and field ticket lands here and runs the same path: bid → approve → schedule → done → invoiced."
        actions={
          <>
            <Segmented value={view} onChange={setView} options={[{ value: 'board', label: 'Board' }, { value: 'list', label: 'List' }]} />
            <Button onClick={() => setCreating(true)}>
              <Plus /> New request
            </Button>
          </>
        }
      />

      {view === 'board' ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-3 scrollbar-thin sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-3">
            {boardStages.map((s) => {
              const items = sorted.filter((t) => t.stage === s.value);
              return (
                <div key={s.value} className="flex w-[268px] shrink-0 flex-col rounded-lg border bg-muted/40">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={s.tone} dot>{s.label}</Badge>
                    </div>
                    <span className="text-xs font-semibold tabular text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
                    {items.length === 0 && <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Empty</div>}
                    {items.map((t) => (
                      <TicketCard key={t.id} t={t} onOpen={() => setOpenId(t.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Request</TH>
                <TH>Client</TH>
                <TH>Stage</TH>
                <TH>Division</TH>
                <TH>Source</TH>
                <TH>Priority</TH>
                <TH>Assigned</TH>
                <TH>Age</TH>
              </TR>
            </THead>
            <TBody>
              {sorted.map((t) => (
                <ListRow key={t.id} t={t} onOpen={() => setOpenId(t.id)} />
              ))}
            </TBody>
          </Table>
          {sorted.length === 0 && <EmptyState icon={<TicketIcon />} title="No requests yet" />}
        </Card>
      )}

      {openTicket && <TicketDialog t={openTicket} onClose={() => setOpenId(null)} />}
      <NewTicketDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id); }} />
    </div>
  );
}

function TicketCard({ t, onOpen }: { t: Ticket; onOpen: () => void }) {
  const { data } = useStore();
  const { property, member } = useLookups();
  const assignee = member(t.assigneeId);
  return (
    <button type="button" onClick={onOpen} className={cn('rounded-md border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40', t.priority === 'urgent' && 'border-destructive/50')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tabular text-muted-foreground">#{t.number}</span>
        <div className="flex items-center gap-1">
          <PriorityBadge priority={t.priority} />
          <SourceIcon source={t.source} />
        </div>
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug">{t.title}</div>
      <div className="mt-1 truncate text-xs" onClick={(e) => e.stopPropagation()}>
        <ClientLink id={t.clientId} className="text-xs" />
      </div>
      <div className="truncate text-xs text-muted-foreground">{property(t.propertyId)?.name ?? '—'}</div>
      <div className="mt-2 flex items-center justify-between">
        <DivisionBadge division={t.division} />
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {ageLabel(t.createdAt, data.today)}
          {assignee && <Avatar name={assignee.name} className="size-6 text-[9px]" hue="194 44% 32%" />}
        </div>
      </div>
    </button>
  );
}

function ListRow({ t, onOpen }: { t: Ticket; onOpen: () => void }) {
  const { data } = useStore();
  const { property, member } = useLookups();
  return (
    <TR className="cursor-pointer" onClick={onOpen}>
      <TD className="tabular text-muted-foreground">#{t.number}</TD>
      <TD>
        <div className="font-medium">{t.title}</div>
        <div className="text-xs text-muted-foreground">{property(t.propertyId)?.name ?? '—'}</div>
      </TD>
      <TD onClick={(e) => e.stopPropagation()}><ClientLink id={t.clientId} /></TD>
      <TD><TicketStageBadge stage={t.stage} /></TD>
      <TD><DivisionBadge division={t.division} /></TD>
      <TD><SourceIcon source={t.source} /></TD>
      <TD><PriorityBadge priority={t.priority} /></TD>
      <TD className="text-sm">{member(t.assigneeId)?.name ?? <span className="text-muted-foreground">—</span>}</TD>
      <TD className="whitespace-nowrap text-xs text-muted-foreground">{ageLabel(t.createdAt, data.today)}</TD>
    </TR>
  );
}

function TicketDialog({ t, onClose }: { t: Ticket; onClose: () => void }) {
  const { data, actions } = useStore();
  const { property, estimate, job } = useLookups();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [date, setDate] = useState(data.today);
  const [crewId, setCrewId] = useState(data.crews.find((c) => c.division === t.division)?.id ?? data.crews[0]?.id ?? '');

  const est = estimate(t.estimateId);
  const estTotal = est ? est.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) : 0;
  const j = job(t.jobId);
  const inv = j?.invoiceId ? data.invoices.find((i) => i.id === j.invoiceId) : undefined;
  const prop = property(t.propertyId);

  const canAct = !!(t.clientId && t.propertyId);

  const primary = (() => {
    switch (t.stage) {
      case 'new':
        return (
          <>
            <Button disabled={!canAct} onClick={() => { actions.createJobFromTicket(t.id); toast({ title: 'Approved as T&M', description: 'Job created — schedule it below or from the waiting list.' }); }}>Approve as T&M</Button>
            <Button variant="outline" onClick={() => { actions.setTicketStage(t.id, 'needs_bid', 'Flagged: needs a bid.'); toast({ title: 'Marked "Needs a bid"' }); }}>Needs a bid</Button>
          </>
        );
      case 'needs_bid':
        return (
          <>
            {est ? (
              <Button onClick={() => { actions.sendEstimate(est.id); toast({ title: `Estimate #${est.number} sent`, description: `$${estTotal.toFixed(2)} emailed to the client.` }); }}>Send estimate #{est.number}</Button>
            ) : (
              <Button onClick={() => { actions.setTicketStage(t.id, 'bid_sent', 'Estimate sent.'); toast({ title: 'Marked as bid sent' }); }}>Send estimate</Button>
            )}
            <Link href="/estimates" className="text-sm text-primary hover:underline">Build estimate →</Link>
          </>
        );
      case 'bid_sent':
        return (
          <>
            <Button variant="success" disabled={!canAct} onClick={() => { if (est) actions.approveEstimate(est.id); actions.createJobFromTicket(t.id); toast({ title: 'Client approved', description: 'Job created and ready to schedule.' }); }}>Client approved</Button>
            <Button variant="outline" onClick={() => { actions.setTicketStage(t.id, 'closed', 'Client declined.'); toast({ title: 'Closed — declined', tone: 'info' }); }}>Declined</Button>
          </>
        );
      case 'approved':
        return (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" /></Field>
            <Field label="Crew">
              <Select value={crewId} onChange={(e) => setCrewId(e.target.value)} className="w-44">
                {data.crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Button disabled={!t.jobId} onClick={() => { actions.scheduleJob(t.jobId!, date, crewId); toast({ title: 'Scheduled', description: `${fmtDate(date)} · ${data.crews.find((c) => c.id === crewId)?.name}` }); }}>Schedule</Button>
          </div>
        );
      case 'scheduled':
        return <Button variant="success" disabled={!t.jobId} onClick={() => { actions.setJobStatus(t.jobId!, 'done'); toast({ title: 'Marked complete', description: 'Invoice drafted for your approval.' }); }}>Mark complete</Button>;
      case 'complete':
        return (
          <div className="flex items-center gap-2 text-sm">
            <Receipt className="size-4 text-accent" />
            <span>Invoice {inv ? `#${inv.number} ` : ''}drafted — <Link href="/invoices" className="font-medium text-primary hover:underline">approve it in Invoices</Link>.</span>
          </div>
        );
      default:
        return <span className="text-sm text-muted-foreground">{t.stage === 'invoiced' ? `Invoiced${inv ? ` (#${inv.number})` : ''} — waiting on payment.` : 'Closed.'}</span>;
    }
  })();

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={<span className="flex items-center gap-2"><span className="tabular text-muted-foreground">#{t.number}</span> {t.title}</span>}
      description={<span className="flex flex-wrap items-center gap-2"><ClientLink id={t.clientId} /> {prop && <span>· {prop.name}, {prop.city}</span>} <TicketStageBadge stage={t.stage} /> <DivisionBadge division={t.division} /> <PriorityBadge priority={t.priority} /></span>}
    >
      <div className="space-y-5">
        <div className="overflow-x-auto scrollbar-thin">
          <Pipeline steps={ticketPipeline(t, data)} />
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><SourceIcon source={t.source} /> via {t.source} · {fmtDateTime(t.createdAt)}</div>
          {t.description || <span className="text-muted-foreground">No description.</span>}
        </div>

        {est && (
          <div className="flex items-center justify-between rounded-md border p-3 text-sm">
            <div>
              <div className="font-medium">Estimate #{est.number} · {est.status}</div>
              <div className="text-xs text-muted-foreground">{est.title}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold tabular">${estTotal.toFixed(2)}</div>
              <Link href="/estimates" className="text-xs text-primary hover:underline">Open</Link>
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next step</div>
          <div className="flex flex-wrap items-center gap-2">{primary}</div>
          {!canAct && ['new', 'bid_sent'].includes(t.stage) && <p className="mt-1 text-xs text-destructive">Assign a client and property before approving.</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Assigned to">
            <Select value={t.assigneeId ?? ''} onChange={(e) => { if (e.target.value) { actions.assignTicket(t.id, e.target.value); toast({ title: 'Assigned' }); } }}>
              <option value="">Unassigned</option>
              {data.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Add note">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; actions.addTicketNote(t.id, note.trim()); setNote(''); toast({ title: 'Note added' }); }}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called client, left VM…" />
              <Button type="submit" variant="outline" size="md">Add</Button>
            </form>
          </Field>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</div>
          <ol className="relative space-y-3 border-l pl-4">
            {t.timeline.map((e, i) => (
              <li key={i} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary" />
                <div className="text-xs text-muted-foreground">{fmtDateTime(e.at)} · {e.who}</div>
                <div>{e.text}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Dialog>
  );
}

function NewTicketDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { data, actions } = useStore();
  const toast = useToast();
  const blank = { title: '', description: '', source: 'call' as TicketSource, priority: 'normal' as Ticket['priority'], clientId: '', propertyId: '', division: 'irrigation' as Division, needsBid: false };
  const [f, setF] = useState(blank);
  const [voice, setVoice] = useState('');
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((x) => ({ ...x, [k]: v }));

  const clients = data.clients.filter((c) => c.status !== 'former');
  const props = data.properties.filter((p) => p.clientId === f.clientId);

  const parse = () => {
    const text = voice.trim();
    if (!text) return;
    const lower = text.toLowerCase();
    const words = lower.replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4);
    let match: { clientId: string; propertyId: string } | undefined;
    for (const p of data.properties) {
      const c = data.clients.find((c) => c.id === p.clientId);
      const hay = `${p.name} ${c?.name ?? ''}`.toLowerCase();
      const hayWords = hay.replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !['place', 'residence', 'common', 'areas', 'estates', 'village', 'commons', 'group', 'park', 'office'].includes(w));
      if (words.some((w) => hayWords.includes(w))) {
        match = { clientId: p.clientId, propertyId: p.id };
        break;
      }
    }
    const afterComma = text.includes(',') ? text.slice(text.indexOf(',') + 1).trim() : text.replace(/^(job |new )?ticket for /i, '').trim();
    const title = afterComma.charAt(0).toUpperCase() + afterComma.slice(1);
    const div: Division = /sprinkler|head|leak|valve|drip|zone|controller|irrigation/i.test(text) ? 'irrigation' : /backflow/i.test(text) ? 'backflow' : /patio|install|plant|paver/i.test(text) ? 'installs' : 'maintenance';
    setF((x) => ({ ...x, title: title || x.title, description: text, source: 'voice', division: div, clientId: match?.clientId ?? x.clientId, propertyId: match?.propertyId ?? x.propertyId }));
    toast({ title: match ? 'Matched property' : 'Parsed — pick the property', description: match ? `${data.properties.find((p) => p.id === match!.propertyId)?.name}` : 'No property name recognized in the text.', tone: match ? 'success' : 'warning' });
  };

  const submit = () => {
    if (!f.title.trim()) return;
    const t = actions.createTicket({ title: f.title.trim(), description: f.description.trim(), source: f.source, priority: f.priority, clientId: f.clientId || undefined, propertyId: f.propertyId || undefined, division: f.division, needsBid: f.needsBid });
    toast({ title: `Request #${t?.number ?? ''} created` });
    setF(blank);
    setVoice('');
    if (t) onCreated(t.id);
    else onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="New service request"
      description="Log it once; the system routes it through bid, schedule, completion and invoicing."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!f.title.trim()}>Create request</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-accent/40 bg-accent/5 p-3">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><Mic className="size-4 text-accent" /> Voice ticket</div>
          <Textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={2} placeholder="Or paste/dictate: e.g. 'job ticket for Camden Place, sprinkler head broken by mailbox'" />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="accent" onClick={parse} disabled={!voice.trim()}><Wand2 /> Parse</Button>
          </div>
        </div>

        <Field label="Title"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Broken sprinkler head near entrance" /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} /></Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Source">
            <Select value={f.source} onChange={(e) => set('source', e.target.value as TicketSource)}>
              {(['call', 'text', 'email', 'field', 'voice', 'web'] as TicketSource[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={f.priority} onChange={(e) => set('priority', e.target.value as Ticket['priority'])}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="urgent">Urgent</option>
            </Select>
          </Field>
          <Field label="Division">
            <Select value={f.division} onChange={(e) => set('division', e.target.value as Division)}>
              <option value="maintenance">Maintenance</option><option value="irrigation">Irrigation</option><option value="installs">Installs</option><option value="backflow">Backflow</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Client">
            <Select value={f.clientId} onChange={(e) => { const cid = e.target.value; const first = data.properties.find((p) => p.clientId === cid); setF((x) => ({ ...x, clientId: cid, propertyId: first?.id ?? '' })); }}>
              <option value="">— Select —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === 'lead' ? ' (lead)' : ''}</option>)}
            </Select>
          </Field>
          <Field label="Property">
            <Select value={f.propertyId} onChange={(e) => set('propertyId', e.target.value)} disabled={!f.clientId}>
              <option value="">— Select —</option>
              {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.needsBid} onChange={(e) => set('needsBid', e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
          Needs a bid before work (skip for T&M repairs)
        </label>
        {f.propertyId && <div className="text-xs text-muted-foreground">Property: <PropertyLabel id={f.propertyId} withAddress /></div>}
      </div>
    </Dialog>
  );
}
