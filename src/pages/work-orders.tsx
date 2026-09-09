import { useMemo, useState } from 'react';
import { Wrench, Plus, Trash2, Receipt, Info } from 'lucide-react';
import { useStore } from '@/data/store';
import type { PartUsage, WorkOrder } from '@/data/types';
import { Button, Card, CardContent, Badge, Input, Select, Textarea, Field, Dialog, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, EmptyState, useToast, type Tone } from '@/components/ui';
import { useLookups, ClientLink, PropertyLabel } from '@/components/shared';
import { money, fmtDate, hhmmToMinutes, cn, sum } from '@/lib/utils';
import { partSellPrice, round2 } from '@/lib/pricing';
import { useLocation } from 'wouter';

const TRIP_FEE = 45;
const STATUS: Record<WorkOrder['status'], { tone: Tone; label: string }> = { open: { tone: 'warning', label: 'Open' }, submitted: { tone: 'info', label: 'Invoice drafted' }, invoiced: { tone: 'success', label: 'Invoiced' } };

function laborHours(wo: Pick<WorkOrder, 'timeIn' | 'timeOut'>) {
  if (!wo.timeIn || !wo.timeOut) return 0;
  return Math.max(0, round2((hhmmToMinutes(wo.timeOut) - hhmmToMinutes(wo.timeIn)) / 60));
}

export default function WorkOrders() {
  const { data, actions } = useStore();
  const { member, part, invoice } = useLookups();
  const toast = useToast();
  const [, navigate] = useLocation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const partsSell = (parts: PartUsage[]) => sum(parts.map((u) => (part(u.partId) ? partSellPrice(part(u.partId)!) * u.qty : 0)));
  const laborCost = (wo: WorkOrder) => laborHours(wo) * wo.laborRate;
  const total = (wo: WorkOrder) => (wo.timeOut ? TRIP_FEE + laborCost(wo) + partsSell(wo.parts) : 0);

  const rows = useMemo(() => [...data.workOrders].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number), [data.workOrders]);
  const openToday = rows.filter((w) => w.status === 'open' && w.date === data.today);
  const submitted = rows.filter((w) => w.status === 'submitted');
  const invoicedMonth = rows.filter((w) => w.status === 'invoiced' && w.date.startsWith(data.today.slice(0, 7)));

  const current = rows.find((w) => w.id === openId);

  return (
    <div>
      <PageHeader
       
        title="Work Orders"
        subtitle="Your paper ticket, digitized. Time in and out plus the bucket count, priced automatically."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New work order
          </Button>
        }
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-muted/50 p-3 text-[13px]">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <span className="font-medium">Tech counts the bucket, picks parts, submits.</span> Labor and parts are priced automatically ({money(TRIP_FEE)} trip fee + hours × tech rate + parts at catalog markup) and an invoice is drafted for your approval.
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Open today" value={openToday.length} sub="Tech still on site" icon={<Wrench />} />
        <Stat label="Awaiting invoice approval" value={submitted.length} sub={money(sum(submitted.map(total)))} tone={submitted.length ? 'accent' : 'default'} onClick={() => navigate('/invoices')} />
        <Stat label="Invoiced this month" value={money(sum(invoicedMonth.map(total)))} sub={`${invoicedMonth.length} work orders`} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Wrench />} title="No work orders yet" action={<Button onClick={() => setCreating(true)}>New work order</Button>} />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Date</TH>
                <TH>Property</TH>
                <TH>Tech</TH>
                <TH>Time</TH>
                <TH className="text-right">Parts</TH>
                <TH className="text-right">Labor $</TH>
                <TH className="text-right">Parts $</TH>
                <TH className="text-right">Total</TH>
                <TH>Status</TH>
                <TH>Invoice</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((wo) => {
                const inv = invoice(wo.invoiceId);
                const st = STATUS[wo.status];
                return (
                  <TR key={wo.id} onClick={() => setOpenId(wo.id)} className="cursor-pointer">
                    <TD className="font-mono text-[12.5px] text-muted-foreground">{wo.number}</TD>
                    <TD className="whitespace-nowrap">{fmtDate(wo.date)}</TD>
                    <TD>
                      <div className="font-medium">
                        <PropertyLabel id={wo.propertyId} />
                      </div>
                      <div className="text-xs">
                        <ClientLink id={wo.clientId} className="font-normal text-muted-foreground" />
                      </div>
                    </TD>
                    <TD>{member(wo.techId)?.name}</TD>
                    <TD className="whitespace-nowrap tabular">
                      {wo.timeIn}
                      {wo.timeOut ? `–${wo.timeOut}` : ' – …'}
                      {wo.timeOut && <span className="ml-1 text-xs text-muted-foreground">({laborHours(wo)} h)</span>}
                    </TD>
                    <TD className="text-right tabular">{sum(wo.parts.map((p) => p.qty)) || '—'}</TD>
                    <TD className="text-right tabular">{wo.timeOut ? money(laborCost(wo)) : '—'}</TD>
                    <TD className="text-right tabular">{wo.parts.length ? money(partsSell(wo.parts)) : '—'}</TD>
                    <TD className="text-right font-medium tabular">{wo.timeOut ? money(total(wo)) : '—'}</TD>
                    <TD>
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                    </TD>
                    <TD onClick={(e) => e.stopPropagation()}>
                      {inv ? (
                        <button type="button" onClick={() => navigate('/invoices')} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          <Receipt className="size-3.5" /> #{inv.number}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      {current && <DetailDialog wo={current} onClose={() => setOpenId(null)} />}
      {creating && (
        <NewDialog
          onClose={() => setCreating(false)}
          onSubmit={(wo) => {
            const nextNo = data.counters.workOrder;
            actions.submitWorkOrder(wo);
            toast({ title: `Work order #${nextNo} submitted`, description: 'Invoice drafted for your approval.' });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Detail
function DetailDialog({ wo, onClose }: { wo: WorkOrder; onClose: () => void }) {
  const { member, part, client, property } = useLookups();
  const hrs = laborHours(wo);
  const partLines = wo.parts.map((u) => ({ u, p: part(u.partId) })).filter((x) => !!x.p);
  const partsTotal = sum(partLines.map(({ u, p }) => partSellPrice(p!) * u.qty));
  const labor = hrs * wo.laborRate;
  const st = STATUS[wo.status];
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Work order #${wo.number}`}
      description={`${property(wo.propertyId)?.name} · ${client(wo.clientId)?.name} · ${fmtDate(wo.date, 'EEE, MMM d')}`}
      size="lg"
      footer={
        <>
          <Badge tone={st.tone} dot>
            {st.label}
          </Badge>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-[11.5px] font-medium text-muted-foreground">Tech</div>
            {member(wo.techId)?.name}
          </div>
          <div>
            <div className="text-[11.5px] font-medium text-muted-foreground">Time</div>
            <span className="tabular">
              {wo.timeIn}
              {wo.timeOut ? `–${wo.timeOut}` : ' – on site'}
            </span>
            {wo.timeOut && <span className="text-muted-foreground"> ({hrs} h)</span>}
          </div>
          <div>
            <div className="text-[11.5px] font-medium text-muted-foreground">Labor rate</div>
            {money(wo.laborRate)}/hr
          </div>
        </div>
        <div>
          <div className="text-[11.5px] font-medium text-muted-foreground">Work performed</div>
          <p className="text-sm">{wo.workPerformed || <span className="text-muted-foreground">Not entered yet.</span>}</p>
        </div>
        <div>
          <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Parts from the bucket</div>
          {partLines.length === 0 ? (
            <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">No parts used.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Part</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Markup</TH>
                  <TH className="text-right">Sell</TH>
                  <TH className="text-right">Line</TH>
                </TR>
              </THead>
              <TBody>
                {partLines.map(({ u, p }) => (
                  <TR key={u.partId}>
                    <TD>
                      <div className="font-medium">{p!.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p!.sku} · {p!.supplier}
                      </div>
                    </TD>
                    <TD className="text-right tabular">
                      {u.qty} {p!.unit}
                    </TD>
                    <TD className="text-right tabular">{money(p!.cost)}</TD>
                    <TD className="text-right tabular">{p!.markupPct}%</TD>
                    <TD className="text-right tabular">{money(partSellPrice(p!))}</TD>
                    <TD className="text-right font-medium tabular">{money(partSellPrice(p!) * u.qty)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">How this priced</div>
          <div className="num grid gap-1">
            <Row label="Trip fee" value={money(TRIP_FEE)} />
            <Row label={`Labor · ${hrs} h × ${money(wo.laborRate)}`} value={money(labor)} />
            <Row label="Parts at cost × (1 + markup)" value={money(partsTotal)} />
            <div className="mt-1 flex justify-between border-t pt-1 font-bold">
              <span>Invoice total</span>
              <span>{wo.timeOut ? money(TRIP_FEE + labor + partsTotal) : '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------- New work order
function NewDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (wo: Omit<WorkOrder, 'id' | 'number' | 'status' | 'invoiceId'>) => void }) {
  const { data, currentUser } = useStore();
  const { part } = useLookups();
  const clients = data.clients.filter((c) => c.status === 'active');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const props = data.properties.filter((p) => p.clientId === clientId);
  const [propertyId, setPropertyId] = useState(props[0]?.id ?? '');
  const [jobId, setJobId] = useState('');
  const [techId, setTechId] = useState(currentUser.crewId === 'crew_irr' ? currentUser.id : 'tm_kyle');
  const [date, setDate] = useState(data.today);
  const [timeIn, setTimeIn] = useState('08:00');
  const [timeOut, setTimeOut] = useState('09:30');
  const [work, setWork] = useState('');
  const [parts, setParts] = useState<PartUsage[]>([]);
  const [pickPart, setPickPart] = useState(data.parts[0]?.id ?? '');
  const [pickQty, setPickQty] = useState(1);

  const openJobs = data.jobs.filter((j) => j.propertyId === propertyId && j.status !== 'done' && j.status !== 'skipped');
  const hrs = laborHours({ timeIn, timeOut });
  const rate = 85;
  const partsTotal = sum(parts.map((u) => (part(u.partId) ? partSellPrice(part(u.partId)!) * u.qty : 0)));
  const total = TRIP_FEE + hrs * rate + partsTotal;
  const valid = clientId && propertyId && techId && hrs > 0;

  const addPart = () => {
    if (!pickPart || pickQty <= 0) return;
    setParts((ps) => {
      const ex = ps.find((p) => p.partId === pickPart);
      return ex ? ps.map((p) => (p.partId === pickPart ? { ...p, qty: p.qty + pickQty } : p)) : [...ps, { partId: pickPart, qty: pickQty }];
    });
    setPickQty(1);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="New work order"
      description="Time in/out plus the bucket count. Everything else is priced for you."
      size="xl"
      footer={
        <>
          <div className="mr-auto text-sm text-muted-foreground">
            {money(TRIP_FEE)} trip + {hrs} h × {money(rate)} + parts {money(partsTotal)} = <span className="text-base font-bold text-foreground tabular">{money(total)}</span>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={() => onSubmit({ jobId: jobId || undefined, ticketId: data.jobs.find((j) => j.id === jobId)?.ticketId, propertyId, clientId, date, techId, timeIn, timeOut, laborRate: rate, parts, workPerformed: work })}>
            <Wrench /> Submit & draft invoice
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Client">
            <Select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setPropertyId(data.properties.find((p) => p.clientId === e.target.value)?.id ?? '');
                setJobId('');
              }}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Property">
            <Select
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setJobId('');
              }}
            >
              {props.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Link to job (optional)" hint="Marks the job done when you submit.">
            <Select value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">No linked job</option>
              {openJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                  {j.scheduledDate ? ` (${fmtDate(j.scheduledDate)})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Tech">
            <Select value={techId} onChange={(e) => setTechId(e.target.value)}>
              {data.team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time in">
            <Input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
          </Field>
          <Field label="Time out" hint={hrs > 0 ? `${hrs} h labor` : 'Must be after time in'}>
            <Input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
          </Field>
        </div>
        <Field label="Work performed">
          <Textarea value={work} onChange={(e) => setWork(e.target.value)} placeholder="Replaced two pop-ups on zone 3, adjusted rotor arcs, tested all zones…" />
        </Field>

        <div className="hairline overflow-hidden rounded-lg">
          <div className="flex flex-wrap items-end gap-2 border-b border-border/70 bg-muted/40 p-3">
            <Field label="Part from the bucket" className="min-w-[260px] flex-1">
              <Select value={pickPart} onChange={(e) => setPickPart(e.target.value)}>
                {data.parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {money(partSellPrice(p))}/{p.unit}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Qty" className="w-24">
              <Input type="number" min={1} step={1} value={pickQty} onChange={(e) => setPickQty(Number(e.target.value))} className="tabular" />
            </Field>
            <Button variant="secondary" onClick={addPart}>
              <Plus /> Add
            </Button>
          </div>
          {parts.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No parts yet. Count the bucket and add what was used.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Part</TH>
                  <TH className="w-24 text-right">Qty</TH>
                  <TH className="w-28 text-right">Sell</TH>
                  <TH className="w-28 text-right">Line</TH>
                  <TH className="w-10" />
                </TR>
              </THead>
              <TBody>
                {parts.map((u) => {
                  const p = part(u.partId)!;
                  return (
                    <TR key={u.partId}>
                      <TD>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          cost {money(p.cost)} + {p.markupPct}%
                        </div>
                      </TD>
                      <TD>
                        <Input type="number" min={1} value={u.qty} onChange={(e) => setParts((ps) => ps.map((x) => (x.partId === u.partId ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x)))} className="h-8 text-right tabular" />
                      </TD>
                      <TD className="text-right tabular">{money(partSellPrice(p))}</TD>
                      <TD className="text-right font-medium tabular">{money(partSellPrice(p) * u.qty)}</TD>
                      <TD>
                        <button type="button" onClick={() => setParts((ps) => ps.filter((x) => x.partId !== u.partId))} className="rounded p-1 text-muted-foreground hover:text-destructive" aria-label="Remove">
                          <Trash2 className="size-4" />
                        </button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
          <div className={cn('flex justify-end border-t px-3 py-2 text-sm', parts.length === 0 && 'hidden')}>
            Parts total <span className="ml-2 font-semibold tabular">{money(partsTotal)}</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
