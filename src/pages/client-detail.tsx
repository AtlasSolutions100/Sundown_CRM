import { useMemo, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, MessageSquare, Mail, Phone, MapPin, Plus, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Select, Textarea, Field, Dialog, Tabs, Segmented, Progress, MilestoneBar, Table, THead, TBody, TR, TH, TD, Stat, EmptyState, Pipeline, useToast, type Tone } from '@/components/ui';
import { useLookups, JobStatusBadge, TicketStageBadge, ticketPipeline, InvoiceStatusBadge, DivisionBadge, SourceIcon, CrewChip, StatePill } from '@/components/shared';
import { contractProgress, clientBalance, invoiceTotal, marginByClient, marginByClientDivision, type LineProgress } from '@/lib/metrics';
import { money, pct, fmtDate, fmtDateLong, fmtDateTime, fmtTime, daysBetween, cn, sum } from '@/lib/utils';
import type { Division, TicketSource } from '@/data/types';

type Tab = 'overview' | 'contract' | 'properties' | 'requests' | 'jobs' | 'invoices' | 'inbox' | 'notes';

const stateTone = (s: LineProgress['state']): Tone | 'empty' => (s === 'done' ? 'success' : s === 'behind' ? 'danger' : s === 'due' ? 'warning' : s === 'scheduled' ? 'info' : s === 'skipped' ? 'neutral' : 'empty');
const invTone = (s: LineProgress['invoiceState']): Tone => (s === 'paid' ? 'success' : s === 'overdue' ? 'danger' : s === 'sent' ? 'info' : s === 'pending' ? 'accent' : 'outline');

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, update, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [composer, setComposer] = useState<'text' | 'email' | null>(null);
  const [composeBody, setComposeBody] = useState('');
  const [newReq, setNewReq] = useState(false);

  const c = L.client(id);
  const props = data.properties.filter((p) => p.clientId === id);
  const contracts = data.contracts.filter((k) => k.clientId === id);
  const progs = useMemo(() => contracts.map((k) => contractProgress(data, k)).filter((x) => !!x).map((x) => x!), [contracts, data]);
  const tickets = data.tickets.filter((t) => t.clientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const jobs = data.jobs.filter((j) => j.clientId === id);
  const invoices = data.invoices.filter((i) => i.clientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const msgs = data.messages.filter((m) => m.clientId === id).sort((a, b) => a.at.localeCompare(b.at));
  const margin = useMemo(() => marginByClient(data).find((r) => r.key === id), [data, id]);
  const divMargins = useMemo(() => (id ? marginByClientDivision(data, id) : []), [data, id]);

  if (!c) {
    return (
      <EmptyState title="Client not found" action={<Link href="/clients"><Button variant="outline"><ArrowLeft /> Back to clients</Button></Link>} />
    );
  }

  const balance = clientBalance(data, c.id);
  const doneCount = sum(progs.map((p) => p.done));
  const totalCount = sum(progs.map((p) => p.total));
  const behindCount = sum(progs.map((p) => p.behind));
  const upcoming = jobs.filter((j) => j.status !== 'done' && j.status !== 'skipped' && (j.scheduledDate ?? j.windowStart) >= data.today && daysBetween(data.today, j.scheduledDate ?? j.windowStart) <= 30).sort((a, b) => (a.scheduledDate ?? a.windowStart).localeCompare(b.scheduledDate ?? b.windowStart));

  return (
    <div>
      <Link href="/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Clients</Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight">{c.name}</h1>
            <Badge tone="outline">{c.type === 'hoa' ? 'HOA' : c.type === 'commercial' ? 'Commercial' : 'Residential'}</Badge>
            <Badge tone={c.status === 'active' ? 'success' : c.status === 'lead' ? 'accent' : 'neutral'} dot>{c.status === 'active' ? 'Active' : c.status === 'lead' ? 'Lead' : 'Former'}</Badge>
            {c.contractSince && <Badge tone="outline">{c.termYears}-yr term since {c.contractSince.slice(0, 4)}</Badge>}
          </div>
          <div className="mt-2 grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
            <span>{c.contactName}</span>
            <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" /> {c.phone}{c.altPhones.length > 0 && <span className="text-xs">(+{c.altPhones.length})</span>}</span>
            <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" /> {c.email}</span>
            {c.billingEmail && <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" /> Billing: {c.billingEmail}</span>}
            <span className="inline-flex items-center gap-1.5 sm:col-span-2"><MapPin className="size-3.5" /> {c.address}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {c.tags.map((t) => (
              <Badge key={t} tone="outline">{t}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setComposer('text')}><MessageSquare /> Text</Button>
          <Button variant="outline" onClick={() => setComposer('email')}><Mail /> Email</Button>
          <Button onClick={() => setNewReq(true)}><Plus /> New request</Button>
        </div>
      </div>

      {composer && (
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
            <div className="text-xs font-medium text-muted-foreground sm:w-28 sm:pt-2">
              {composer === 'text' ? `Text ${c.phone}` : `Email ${c.email}`}
            </div>
            <Textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} className="min-h-[60px] flex-1" placeholder="Type your message…" />
            <div className="flex gap-2 sm:flex-col">
              <Button
                disabled={!composeBody.trim()}
                onClick={() => {
                  actions.sendMessage(c.id, composer, composeBody.trim());
                  toast({ title: `${composer === 'text' ? 'Text' : 'Email'} sent` });
                  setComposeBody('');
                  setComposer(null);
                }}
              >
                <Send /> Send
              </Button>
              <Button variant="ghost" onClick={() => setComposer(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Balance" value={money(balance)} tone={balance > 0 ? 'warning' : 'default'} sub={balance > 0 ? `${invoices.filter((i) => i.status === 'overdue').length} overdue` : 'Paid up'} />
        <Stat label="2026 completion" value={totalCount ? `${doneCount} / ${totalCount}` : '—'} sub={behindCount ? `${behindCount} behind` : 'On track'} tone={behindCount ? 'danger' : 'default'} />
        <Stat label="YTD margin" value={margin ? pct(margin.margin) : '—'} sub={margin ? `${money(margin.profit, { cents: false })} on ${money(margin.revenue, { cents: false })}` : 'No completed work'} tone={margin && margin.margin < 0.15 ? 'danger' : 'default'} />
        <Stat label="Realized $/hr" value={margin ? money(margin.realizedHourly, { cents: false }) : '—'} sub={margin ? `${margin.laborHours.toFixed(0)} labor hrs` : undefined} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'contract', label: 'Contract progress', count: behindCount || undefined },
          { value: 'properties', label: 'Properties & Backflow', count: props.length },
          { value: 'requests', label: 'Requests', count: tickets.filter((t) => !['closed', 'invoiced'].includes(t.stage)).length || undefined },
          { value: 'jobs', label: 'Jobs' },
          { value: 'invoices', label: 'Invoices', count: invoices.filter((i) => i.status === 'sent' || i.status === 'overdue' || i.status === 'pending_approval').length || undefined },
          { value: 'inbox', label: 'Inbox', count: msgs.filter((m) => !m.read && m.direction === 'in').length || undefined },
          { value: 'notes', label: 'Notes' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="grid gap-4 md:grid-cols-2">
              {props.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>{p.address}, {p.city}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Turf</span> <span className="tabular font-medium">{p.turfSqft.toLocaleString()} sqft</span></div>
                    <div><span className="text-muted-foreground">Beds</span> <span className="tabular font-medium">{p.bedSqft.toLocaleString()} sqft</span></div>
                    <div><span className="text-muted-foreground">Zones</span> <span className="tabular font-medium">{p.zones}</span></div>
                    <div><span className="text-muted-foreground">Gate</span> <span className="font-mono font-medium">{p.gateCode ?? '—'}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Purveyor</span> <span className="font-medium">{L.purveyor(p.purveyorId)?.name ?? '—'}</span></div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Next 30 days</CardTitle>
              </CardHeader>
              <CardContent>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing scheduled or due.</p>
                ) : (
                  <div className="divide-y">
                    {upcoming.slice(0, 8).map((j) => (
                      <div key={j.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div>
                          <div className="font-medium">{j.title}</div>
                          <div className="text-xs text-muted-foreground">{j.scheduledDate ? `Scheduled ${fmtDateLong(j.scheduledDate)}` : `Window ${fmtDate(j.windowStart)} – ${fmtDate(j.windowEnd)}`} · {L.property(j.propertyId)?.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CrewChip crewId={j.crewId} />
                          <JobStatusBadge status={j.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Margin by division</CardTitle>
              <CardDescription>Where this account makes or loses money.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {divMargins.length === 0 && <p className="text-sm text-muted-foreground">No completed work yet.</p>}
              {divMargins.map((r) => (
                <div key={r.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <DivisionBadge division={r.key as Division} />
                    <span className={cn('tabular font-semibold', r.margin < 0.15 ? 'text-destructive' : r.margin < 0.3 ? 'text-[hsl(30_70%_30%)]' : 'text-success')}>{pct(r.margin)}</span>
                  </div>
                  <Progress value={Math.max(0, r.margin)} tone={r.margin < 0.15 ? 'danger' : r.margin < 0.3 ? 'warning' : 'success'} />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular">
                    <span>{money(r.revenue, { cents: false })} rev</span>
                    <span>{r.laborHours.toFixed(1)} h · {money(r.realizedHourly, { cents: false })}/hr</span>
                  </div>
                </div>
              ))}
              {c.termYears === 1 && margin && margin.margin < 0.15 && (
                <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">Margin is under 15%. Find out what happened before offering a multi-year term.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'contract' && (
        <div className="space-y-4">
          {progs.length === 0 && <EmptyState title="No contract this season" description="Assign a package from Services & Packages to draft one." />}
          {progs.map((p) => (
            <ContractCard key={p.contract.id} p={p} />
          ))}
        </div>
      )}

      {tab === 'properties' && (
        <div className="space-y-4">
          {props.map((p) => {
            const devices = data.backflowDevices.filter((d) => d.propertyId === p.id);
            return (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                  <CardDescription>{p.address}, {p.city} · {p.turfSqft.toLocaleString()} sqft turf · {p.bedSqft.toLocaleString()} sqft beds · {p.zones} zones{p.gateCode ? ` · gate ${p.gateCode}` : ''}</CardDescription>
                </CardHeader>
                <CardContent>
                  {devices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No backflow devices on file.</p>
                  ) : (
                    <Table>
                      <THead>
                        <TR><TH>Device</TH><TH>Type</TH><TH>Serial</TH><TH>Location</TH><TH>Purveyor</TH><TH>Last test</TH></TR>
                      </THead>
                      <TBody>
                        {devices.map((d) => {
                          const t = data.backflowTests.filter((x) => x.deviceId === d.id).sort((a, b) => b.date.localeCompare(a.date))[0];
                          return (
                            <TR key={d.id}>
                              <TD className="font-medium">{d.make} {d.model} {d.size}</TD>
                              <TD><Badge tone="info">{d.type}</Badge></TD>
                              <TD className="font-mono text-[12.5px]">{d.serial}</TD>
                              <TD className="text-muted-foreground">{d.location}</TD>
                              <TD className="text-xs">{L.purveyor(d.purveyorId)?.name}</TD>
                              <TD>{t ? <span className="inline-flex items-center gap-2"><Badge tone={t.result === 'pass' ? 'success' : 'danger'}>{t.result.toUpperCase()}</Badge><span className="text-xs text-muted-foreground">{fmtDate(t.date)}</span></span> : <Badge tone="warning">Not tested</Badge>}</TD>
                            </TR>
                          );
                        })}
                      </TBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'requests' && (
        <Card>
          {tickets.length === 0 && <div className="p-5"><EmptyState title="No service requests" /></div>}
          <div className="divide-y divide-border/70">
          {tickets.map((t) => (
              <div key={t.id} className="flex flex-col gap-3 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <SourceIcon source={t.source} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{t.number}</span>
                      <span className="font-medium">{t.title}</span>
                      <TicketStageBadge stage={t.stage} />
                      <DivisionBadge division={t.division} />
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(t.createdAt)} · {L.property(t.propertyId)?.name}{t.assigneeId ? ` · ${L.member(t.assigneeId)?.name}` : ''}</div>
                  </div>
                </div>
                <Pipeline steps={ticketPipeline(t, data)} />
              </div>
          ))}
          </div>
        </Card>
      )}

      {tab === 'jobs' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR><TH>Job</TH><TH>Property</TH><TH>Date</TH><TH>Crew</TH><TH>Status</TH><TH className="text-right">Price</TH></TR>
              </THead>
              <TBody>
                {[...jobs].sort((a, b) => (b.scheduledDate ?? b.windowStart).localeCompare(a.scheduledDate ?? a.windowStart)).map((j) => (
                  <TR key={j.id}>
                    <TD className="font-medium">{j.title}</TD>
                    <TD className="text-muted-foreground">{L.property(j.propertyId)?.name}</TD>
                    <TD>{j.scheduledDate ? fmtDate(j.scheduledDate) : <span className="text-xs text-muted-foreground">{fmtDate(j.windowStart)} – {fmtDate(j.windowEnd)}</span>}</TD>
                    <TD><CrewChip crewId={j.crewId} /></TD>
                    <TD><JobStatusBadge status={j.status} /></TD>
                    <TD className="text-right num">{money(j.price)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'invoices' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR><TH>#</TH><TH>Source</TH><TH>Status</TH><TH className="text-right">Total</TH><TH>Due</TH><TH>Paid</TH></TR>
              </THead>
              <TBody>
                {invoices.map((i) => (
                  <TR key={i.id}>
                    <TD className="font-medium num">{i.number}</TD>
                    <TD className="text-sm">{i.sourceLabel}</TD>
                    <TD><InvoiceStatusBadge status={i.status} /></TD>
                    <TD className="text-right num font-medium">{money(invoiceTotal(i))}</TD>
                    <TD>{fmtDate(i.dueDate)}</TD>
                    <TD>{i.paidAt ? fmtDate(i.paidAt) : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'inbox' && <ClientThread clientId={c.id} />}

      {tab === 'notes' && <NotesCard clientId={c.id} />}

      {newReq && (
        <NewRequestDialog
          clientId={c.id}
          onClose={() => setNewReq(false)}
          onCreate={(input) => {
            actions.createTicket({ ...input, clientId: c.id });
            toast({ title: 'Service request created', description: input.title });
            setNewReq(false);
            setTab('requests');
          }}
        />
      )}
    </div>
  );
}

function ContractCard({ p }: { p: NonNullable<ReturnType<typeof contractProgress>> }) {
  const { actions } = useStore();
  const { crew } = useLookups();
  const toast = useToast();
  const [openSvc, setOpenSvc] = useState<string | null>(null);
  const tone = p.status === 'behind' ? 'danger' : p.status === 'due' ? 'warning' : 'success';
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>{p.property.name} · {p.contract.year}</CardTitle>
          <CardDescription>{p.contract.termYears}-yr term · {money(p.valueTotal, { cents: false })} contract · {money(p.valueRemaining, { cents: false })} remaining</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={tone} dot>{p.status === 'behind' ? `${p.worstDaysBehind} days behind` : p.status === 'due' ? 'Due now' : p.status === 'complete' ? 'Complete' : 'On track'}</Badge>
          <span className="num text-lg font-semibold">{p.done} / {p.total}</span>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={p.done / p.total} tone={tone} className="mb-4" />
        <div className="-mx-5 divide-y divide-border/70 border-t border-border/70">
          {p.byService.map((s) => {
            const lines = p.lines.filter((l) => l.serviceId === s.serviceId);
            const open = openSvc === s.serviceId;
            return (
              <div key={s.serviceId}>
                <button type="button" onClick={() => setOpenSvc(open ? null : s.serviceId)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-muted/40">
                  {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                  <span className="w-44 shrink-0 text-sm font-medium">{s.name}</span>
                  <MilestoneBar className="flex-1" cells={lines.map((l) => ({ tone: stateTone(l.state), title: `${l.label} · ${fmtDate(l.windowStart)}–${fmtDate(l.windowEnd)} · ${l.state}` }))} />
                  <span className="w-16 text-right text-sm tabular">{s.done} / {s.total}</span>
                  {s.behind > 0 && <Badge tone="danger">{s.behind} behind</Badge>}
                </button>
                {open && (
                  <Table>
                    <THead>
                      <TR><TH>Item</TH><TH>Window</TH><TH>State</TH><TH>Scheduled</TH><TH className="text-right">Price</TH><TH>Invoice</TH><TH></TH></TR>
                    </THead>
                    <TBody>
                      {lines.map((l) => (
                        <TR key={l.lineId}>
                          <TD>{l.label}</TD>
                          <TD className="text-xs text-muted-foreground">{fmtDate(l.windowStart)} – {fmtDate(l.windowEnd)}</TD>
                          <TD><StatePill state={l.state} /></TD>
                          <TD className="text-xs">{l.job?.scheduledDate ? `${fmtDate(l.job.scheduledDate)} · ${crew(l.job.crewId)?.name ?? ''}` : '—'}</TD>
                          <TD className="text-right num">{money(l.price)}</TD>
                          <TD><Badge tone={invTone(l.invoiceState)}>{l.invoiceState === 'none' ? 'Not invoiced' : l.invoiceState}</Badge></TD>
                          <TD className="text-right">
                            {l.job && (l.state === 'behind' || l.state === 'due') && (
                              <Button size="xs" variant="outline" onClick={() => { actions.scheduleJob(l.job!.id, new Date().toISOString().slice(0, 10) < l.windowStart ? l.windowStart : '2026-09-09', l.job!.division === 'maintenance' ? 'crew_maint' : 'crew_irr'); toast({ title: 'Scheduled for tomorrow', description: l.label }); }}>Schedule</Button>
                            )}
                            {l.job && l.state === 'scheduled' && (
                              <Button size="xs" variant="outline" onClick={() => { actions.setJobStatus(l.job!.id, 'done'); toast({ title: 'Marked done', description: l.label }); }}>Mark done</Button>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ClientThread({ clientId }: { clientId: string }) {
  const { data, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [channel, setChannel] = useState<'text' | 'email'>('text');
  const [body, setBody] = useState('');
  const c = L.client(clientId);
  const msgs = data.messages.filter((m) => m.clientId === clientId).sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Card>
      <CardContent className="p-0">
        <div className="max-h-[520px] space-y-3 overflow-y-auto p-5 scrollbar-thin">
          {msgs.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
          {msgs.map((m) => {
            const out = m.direction === 'out';
            const t = m.ticketId ? L.ticket(m.ticketId) : undefined;
            return (
              <div key={m.id} className={cn('flex', out ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm', out ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted')}>
                  <div className={cn('mb-1 text-[11px]', out ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{m.channel.replace('_', ' ')} · {fmtDate(m.at)} {fmtTime(m.at)}</div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {t && <div className={cn('mt-1.5 text-[11px] font-medium', out ? 'text-primary-foreground/80' : 'text-primary')}>Ticket #{t.number} · {t.title}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t p-3">
          <div className="mb-2 flex items-center justify-between">
            <Segmented value={channel} onChange={setChannel} options={[{ value: 'text', label: 'Text' }, { value: 'email', label: 'Email' }]} />
            <span className="text-xs text-muted-foreground">to {channel === 'text' ? c?.phone : c?.email}</span>
          </div>
          <div className="flex gap-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[56px]" placeholder="Type a message…" />
            <Button disabled={!body.trim()} onClick={() => { actions.sendMessage(clientId, channel, body.trim()); setBody(''); toast({ title: 'Sent' }); }}><Send /> Send</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotesCard({ clientId }: { clientId: string }) {
  const { data, update } = useStore();
  const toast = useToast();
  const c = data.clients.find((x) => x.id === clientId)!;
  const [notes, setNotes] = useState(c.notes);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Office notes</CardTitle>
        <CardDescription>Gate codes, access quirks, who to call. Crews see these on their job cards.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[160px]" />
        <div className="flex justify-end">
          <Button
            disabled={notes === c.notes}
            onClick={() => {
              update((d) => {
                const x = d.clients.find((k) => k.id === clientId);
                if (x) x.notes = notes;
              });
              toast({ title: 'Notes saved' });
            }}
          >
            Save notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewRequestDialog({ clientId, onClose, onCreate }: { clientId: string; onClose: () => void; onCreate: (input: { title: string; description: string; source: TicketSource; propertyId?: string; division: Division; needsBid: boolean; priority: 'low' | 'normal' | 'urgent' }) => void }) {
  const { data } = useStore();
  const props = data.properties.filter((p) => p.clientId === clientId);
  const [f, setF] = useState({ title: '', description: '', source: 'call' as TicketSource, propertyId: props[0]?.id ?? '', division: 'irrigation' as Division, needsBid: false, priority: 'normal' as 'low' | 'normal' | 'urgent' });
  return (
    <Dialog
      open
      onClose={onClose}
      title="New service request"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!f.title.trim()} onClick={() => onCreate({ ...f, propertyId: f.propertyId || undefined })}>Create</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Sprinkler head broken by mailbox" /></Field>
        <Field label="Details" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Property">
          <Select value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })}>
            {props.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Came in by">
          <Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as TicketSource })}>
            <option value="call">Call</option>
            <option value="text">Text</option>
            <option value="email">Email</option>
            <option value="field">Field</option>
            <option value="voice">Voice</option>
            <option value="web">Web</option>
          </Select>
        </Field>
        <Field label="Division">
          <Select value={f.division} onChange={(e) => setF({ ...f, division: e.target.value as Division })}>
            <option value="irrigation">Irrigation</option>
            <option value="maintenance">Maintenance</option>
            <option value="installs">Installs</option>
            <option value="backflow">Backflow</option>
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as typeof f.priority })}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={f.needsBid} onChange={(e) => setF({ ...f, needsBid: e.target.checked })} /> Needs a bid before work starts
        </label>
      </div>
    </Dialog>
  );
}
