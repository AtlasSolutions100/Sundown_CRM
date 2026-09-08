import { useMemo, useState } from 'react';
import { FileText, Plus, Send, Check, X, Pencil, Eye, Printer, Trash2, Briefcase } from 'lucide-react';
import { useStore } from '@/data/store';
import type { Estimate, EstimateLine, EstimateLineKind, Property } from '@/data/types';
import { Button, Card, Badge, Input, Select, Textarea, Field, Dialog, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, EmptyState, useToast, type Tone } from '@/components/ui';
import { useLookups, ClientLink, DivisionBadge } from '@/components/shared';
import { money, fmtDate, fmtDateLong, cn, sum, uid, titleCase } from '@/lib/utils';
import { priceService, pricingSummary, partSellPrice, round2 } from '@/lib/pricing';

const STATUS_TONE: Record<Estimate['status'], Tone> = { draft: 'neutral', sent: 'info', approved: 'success', declined: 'danger' };
const estTotal = (e: { lines: { qty: number; unitPrice: number }[] }) => round2(sum(e.lines.map((l) => l.qty * l.unitPrice)));

type Draft = {
  id?: string;
  clientId: string;
  propertyId: string;
  ticketId?: string;
  title: string;
  notes: string;
  lines: EstimateLine[];
};

export default function Estimates() {
  const { data, actions, update } = useStore();
  const { client, property, ticket } = useLookups();
  const toast = useToast();
  const [editor, setEditor] = useState<Draft | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const estimates = useMemo(() => [...data.estimates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data.estimates]);
  const drafts = estimates.filter((e) => e.status === 'draft');
  const sent = estimates.filter((e) => e.status === 'sent');
  const approved = estimates.filter((e) => e.status === 'approved');
  const declined = estimates.filter((e) => e.status === 'declined');
  const approvedThisMonth = approved.filter((e) => e.approvedAt?.startsWith(data.today.slice(0, 7)));
  const decided = approved.length + declined.length + sent.length;
  const winRate = decided ? approved.length / decided : 0;

  const openNew = () => {
    const first = data.clients.find((c) => c.status !== 'former');
    const prop = data.properties.find((p) => p.clientId === first?.id);
    setEditor({ clientId: first?.id ?? '', propertyId: prop?.id ?? '', title: '', notes: '', lines: [] });
  };
  const openEdit = (e: Estimate) => setEditor({ id: e.id, clientId: e.clientId, propertyId: e.propertyId, ticketId: e.ticketId, title: e.title, notes: e.notes, lines: structuredClone(e.lines) });

  const save = (d: Draft) => {
    update((s) => {
      if (d.id) {
        const e = s.estimates.find((x) => x.id === d.id);
        if (e) Object.assign(e, { clientId: d.clientId, propertyId: d.propertyId, title: d.title, notes: d.notes, lines: d.lines });
      } else {
        s.estimates.unshift({ id: uid('est'), number: s.counters.estimate++, clientId: d.clientId, propertyId: d.propertyId, ticketId: d.ticketId, title: d.title || 'Untitled estimate', status: 'draft', lines: d.lines, notes: d.notes, createdAt: `${s.today}T09:00:00`, validDays: 30 });
      }
    });
    toast({ title: d.id ? 'Estimate saved' : 'Estimate drafted', description: d.title });
    setEditor(null);
  };

  const previewEst = estimates.find((e) => e.id === previewId);

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Estimates"
        subtitle="Template-driven bids priced by your formula: trip fee + rate per 1,000 sqft. Build one on the spot, send it, convert it to a job."
        actions={
          <Button onClick={openNew}>
            <Plus /> New estimate
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Drafts" value={drafts.length} sub="Not sent yet" icon={<FileText />} />
        <Stat label="Sent / open pipeline" value={money(sum(sent.map(estTotal)), { cents: false })} sub={`${sent.length} awaiting a decision`} tone="accent" />
        <Stat label="Approved this month" value={approvedThisMonth.length} sub={money(sum(approvedThisMonth.map(estTotal)), { cents: false })} tone="success" />
        <Stat label="Win rate" value={`${Math.round(winRate * 100)}%`} sub={`${approved.length} won · ${declined.length} lost · ${sent.length} open`} />
      </div>

      {estimates.length === 0 ? (
        <EmptyState icon={<FileText />} title="No estimates yet" action={<Button onClick={openNew}>New estimate</Button>} />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Title</TH>
                <TH>Client</TH>
                <TH>Property</TH>
                <TH>Status</TH>
                <TH className="text-right">Total</TH>
                <TH>Created / sent</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {estimates.map((e) => {
                const t = ticket(e.ticketId);
                return (
                  <TR key={e.id}>
                    <TD className="font-mono text-xs">{e.number}</TD>
                    <TD>
                      <div className="font-medium">{e.title}</div>
                      {t && <div className="text-xs text-muted-foreground">Ticket #{t.number}</div>}
                    </TD>
                    <TD>
                      <ClientLink id={e.clientId} />
                      {client(e.clientId)?.status === 'lead' && (
                        <Badge tone="accent" className="ml-2">
                          Lead
                        </Badge>
                      )}
                    </TD>
                    <TD className="text-muted-foreground">{property(e.propertyId)?.name}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[e.status]} dot>
                        {titleCase(e.status)}
                      </Badge>
                    </TD>
                    <TD className="text-right font-medium tabular">{money(estTotal(e))}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {fmtDate(e.createdAt)}
                      {e.sentAt ? ` / ${fmtDate(e.sentAt)}` : ''}
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="ghost" onClick={() => setPreviewId(e.id)}>
                          <Eye /> View
                        </Button>
                        {e.status === 'draft' && (
                          <>
                            <Button size="xs" variant="outline" onClick={() => openEdit(e)}>
                              <Pencil /> Edit
                            </Button>
                            <Button
                              size="xs"
                              onClick={() => {
                                actions.sendEstimate(e.id);
                                toast({ title: `Estimate #${e.number} sent`, description: `${client(e.clientId)?.name} · ${money(estTotal(e))}` });
                              }}
                            >
                              <Send /> Send
                            </Button>
                          </>
                        )}
                        {e.status === 'sent' && (
                          <>
                            <Button
                              size="xs"
                              variant="success"
                              onClick={() => {
                                actions.approveEstimate(e.id);
                                toast({ title: `Estimate #${e.number} approved`, description: 'Create the job when you are ready to schedule.' });
                              }}
                            >
                              <Check /> Mark approved
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                update((s) => {
                                  const x = s.estimates.find((y) => y.id === e.id);
                                  if (x) x.status = 'declined';
                                  const tk = s.tickets.find((y) => y.id === e.ticketId);
                                  if (tk) {
                                    tk.stage = 'closed';
                                    tk.timeline.push({ at: `${s.today}T12:00:00`, who: 'David Ramsey', text: `Client declined estimate #${e.number}.` });
                                  }
                                });
                                toast({ title: `Estimate #${e.number} marked declined`, tone: 'warning' });
                              }}
                            >
                              <X /> Declined
                            </Button>
                          </>
                        )}
                        {e.status === 'approved' && t && !t.jobId && (
                          <Button
                            size="xs"
                            variant="accent"
                            onClick={() => {
                              actions.createJobFromTicket(t.id);
                              toast({ title: 'Job created', description: 'Find it on the waiting list in Schedule & Routes.' });
                            }}
                          >
                            <Briefcase /> Create job
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      {editor && <EditorDialog draft={editor} onChange={setEditor} onClose={() => setEditor(null)} onSave={save} />}
      {previewEst && <ProposalPreview est={previewEst} onClose={() => setPreviewId(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- Editor
function EditorDialog({ draft, onChange, onClose, onSave }: { draft: Draft; onChange: (d: Draft) => void; onClose: () => void; onSave: (d: Draft) => void }) {
  const { data } = useStore();
  const { service } = useLookups();
  const [templateId, setTemplateId] = useState('');
  const [partId, setPartId] = useState(data.parts[0]?.id ?? '');
  const [preview, setPreview] = useState(false);

  const clients = data.clients.filter((c) => c.status !== 'former');
  const props = data.properties.filter((p) => p.clientId === draft.clientId);
  const prop = data.properties.find((p) => p.id === draft.propertyId);

  const setLines = (lines: EstimateLine[]) => onChange({ ...draft, lines });
  const patchLine = (id: string, patch: Partial<EstimateLine>) => setLines(draft.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const applyTemplate = (tid: string) => {
    setTemplateId(tid);
    const tpl = data.estimateTemplates.find((t) => t.id === tid);
    if (!tpl) return;
    const lines: EstimateLine[] = tpl.lines.map((l) => {
      let unitPrice = l.unitPrice;
      if (l.serviceId && unitPrice === 0 && prop) {
        const svc = service(l.serviceId);
        if (svc) {
          const qty = svc.id === 'svc_backflow' ? data.backflowDevices.filter((d) => d.propertyId === prop.id).length || 1 : 1;
          unitPrice = priceService(svc.pricing, prop, qty);
        }
      }
      return { ...l, id: uid('el'), unitPrice };
    });
    onChange({ ...draft, lines, title: draft.title || `${tpl.name} – ${prop?.name ?? ''}` });
  };

  const addPart = () => {
    const p = data.parts.find((x) => x.id === partId);
    if (!p) return;
    setLines([...draft.lines, { id: uid('el'), kind: 'part', description: p.name, qty: 1, unit: p.unit, unitPrice: partSellPrice(p), partId: p.id }]);
  };

  const total = estTotal(draft);

  return (
    <Dialog
      open
      onClose={onClose}
      title={draft.id ? 'Edit estimate' : 'New estimate'}
      description={prop ? `${prop.name} · ${prop.turfSqft.toLocaleString()} sqft turf · ${prop.bedSqft.toLocaleString()} sqft beds · ${prop.zones} zones` : 'Pick a client and property'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => setPreview((v) => !v)}>
            <Printer /> {preview ? 'Back to edit' : 'Print preview'}
          </Button>
          <div className="mr-auto text-sm text-muted-foreground">
            Total <span className="text-base font-bold text-foreground tabular">{money(total)}</span>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!draft.clientId || !draft.propertyId} onClick={() => onSave(draft)}>
            <Check /> Save {draft.id ? 'changes' : 'draft'}
          </Button>
        </>
      }
    >
      {preview ? (
        <ProposalBody est={{ ...draft, number: 0, status: 'draft', createdAt: `${data.today}T09:00:00`, validDays: 30, id: draft.id ?? 'new' }} />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Client">
              <Select
                value={draft.clientId}
                onChange={(e) => {
                  const cid = e.target.value;
                  const p = data.properties.find((x) => x.clientId === cid);
                  onChange({ ...draft, clientId: cid, propertyId: p?.id ?? '' });
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === 'lead' ? ' (lead)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Property">
              <Select value={draft.propertyId} onChange={(e) => onChange({ ...draft, propertyId: e.target.value })}>
                {props.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start from template" hint="Service lines price themselves from the property's square footage.">
              <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Blank</option>
                {data.estimateTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Title">
            <Input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} placeholder="e.g. Backyard paver patio + 3 trees" />
          </Field>

          <div className="rounded-md border">
            <Table>
              <THead>
                <TR>
                  <TH className="w-28">Kind</TH>
                  <TH>Description</TH>
                  <TH className="w-20 text-right">Qty</TH>
                  <TH className="w-20">Unit</TH>
                  <TH className="w-28 text-right">Unit price</TH>
                  <TH className="w-28 text-right">Total</TH>
                  <TH className="w-10" />
                </TR>
              </THead>
              <TBody>
                {draft.lines.length === 0 && (
                  <TR>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No lines yet. Pick a template or add lines below.
                    </td>
                  </TR>
                )}
                {draft.lines.map((l) => {
                  const svc = service(l.serviceId);
                  const info = l.kind === 'info';
                  return (
                    <TR key={l.id}>
                      <TD>
                        <Select value={l.kind} onChange={(e) => patchLine(l.id, { kind: e.target.value as EstimateLineKind })} className="h-8">
                          <option value="service">Service</option>
                          <option value="part">Part</option>
                          <option value="labor">Labor</option>
                          <option value="info">Info</option>
                        </Select>
                      </TD>
                      <TD>
                        <Input value={l.description} onChange={(e) => patchLine(l.id, { description: e.target.value })} className="h-8" />
                        {svc && <div className="mt-1 text-[11px] text-muted-foreground">Formula: {pricingSummary(svc.pricing)}</div>}
                      </TD>
                      <TD>
                        <Input type="number" step="0.25" min={0} disabled={info} value={l.qty} onChange={(e) => patchLine(l.id, { qty: Number(e.target.value) })} className="h-8 text-right tabular" />
                      </TD>
                      <TD>
                        <Input value={l.unit} disabled={info} onChange={(e) => patchLine(l.id, { unit: e.target.value })} className="h-8" />
                      </TD>
                      <TD>
                        <Input type="number" step="0.01" min={0} disabled={info} value={l.unitPrice} onChange={(e) => patchLine(l.id, { unitPrice: Number(e.target.value) })} className="h-8 text-right tabular" />
                      </TD>
                      <TD className={cn('text-right font-medium tabular', info && 'text-muted-foreground')}>{info ? '—' : money(l.qty * l.unitPrice)}</TD>
                      <TD>
                        <button type="button" onClick={() => setLines(draft.lines.filter((x) => x.id !== l.id))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove line">
                          <Trash2 className="size-4" />
                        </button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <div className="flex flex-wrap items-center gap-2 border-t p-2">
              <Button size="sm" variant="outline" onClick={() => setLines([...draft.lines, { id: uid('el'), kind: 'labor', description: '', qty: 1, unit: 'hr', unitPrice: 85 }])}>
                <Plus /> Add line
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Select value={partId} onChange={(e) => setPartId(e.target.value)} className="h-8 w-72">
                  {data.parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {money(partSellPrice(p))}/{p.unit}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="secondary" onClick={addPart}>
                  <Plus /> Add part
                </Button>
              </div>
            </div>
          </div>

          <Field label="Notes to client">
            <Textarea value={draft.notes} onChange={(e) => onChange({ ...draft, notes: e.target.value })} placeholder="Scope, exclusions, timing…" />
          </Field>
        </div>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- Proposal preview
function ProposalPreview({ est, onClose }: { est: Estimate; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={`Estimate #${est.number}`} description={est.title} size="lg" footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      <ProposalBody est={est} />
    </Dialog>
  );
}

function ProposalBody({ est }: { est: Pick<Estimate, 'id' | 'number' | 'clientId' | 'propertyId' | 'title' | 'lines' | 'notes' | 'createdAt' | 'validDays' | 'status'> }) {
  const { data } = useStore();
  const { client, property, ticket } = useLookups();
  const c = client(est.clientId);
  const p: Property | undefined = property(est.propertyId);
  const s = data.settings;
  const t = ticket((est as Estimate).ticketId);
  const groups: { kind: EstimateLineKind; label: string }[] = [
    { kind: 'service', label: 'Services' },
    { kind: 'labor', label: 'Labor' },
    { kind: 'part', label: 'Materials' },
  ];
  const info = est.lines.filter((l) => l.kind === 'info');
  return (
    <div className="rounded-lg border bg-white p-6 text-[13px] text-neutral-900 shadow-inner">
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <div className="text-lg font-bold">{s.name}</div>
          <div className="text-neutral-600">
            {s.address}, {s.city}
            <br />
            {s.serviceLine} · {s.email}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tracking-tight">PROPOSAL</div>
          {est.number > 0 && <div className="text-neutral-600">#{est.number}</div>}
          <div className="text-neutral-600">{fmtDateLong(est.createdAt)}</div>
          <div className="text-neutral-600">Valid {est.validDays} days</div>
        </div>
      </div>
      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Prepared for</div>
          <div className="font-medium">{c?.name}</div>
          <div className="text-neutral-600">
            {c?.contactName}
            <br />
            {c?.email}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Property</div>
          <div className="font-medium">{p?.name}</div>
          <div className="text-neutral-600">
            {p?.address}, {p?.city}
          </div>
          {t && <div className="mt-1 inline-flex"><DivisionBadge division={t.division} /></div>}
        </div>
      </div>
      <div className="mb-3 text-base font-semibold">{est.title}</div>
      {groups.map((g) => {
        const lines = est.lines.filter((l) => l.kind === g.kind);
        if (!lines.length) return null;
        return (
          <div key={g.kind} className="mb-3">
            <div className="border-b text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{g.label}</div>
            {lines.map((l) => (
              <div key={l.id} className="flex items-baseline justify-between gap-4 border-b border-neutral-100 py-1.5">
                <span>{l.description}</span>
                <span className="shrink-0 text-neutral-500 tabular">
                  {l.qty} {l.unit} × {money(l.unitPrice)}
                </span>
                <span className="w-24 shrink-0 text-right font-medium tabular">{money(l.qty * l.unitPrice)}</span>
              </div>
            ))}
          </div>
        );
      })}
      <div className="flex justify-end">
        <div className="flex w-64 justify-between border-t-2 border-neutral-900 pt-2 text-base font-bold">
          <span>Total</span>
          <span className="tabular">{money(estTotal(est))}</span>
        </div>
      </div>
      {info.length > 0 && (
        <div className="mt-4 rounded bg-neutral-50 p-3 text-neutral-700">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Notes</div>
          {info.map((l) => (
            <div key={l.id}>{l.description}</div>
          ))}
        </div>
      )}
      {est.notes && <p className="mt-3 whitespace-pre-wrap text-neutral-700">{est.notes}</p>}
      <div className="mt-6 grid grid-cols-2 gap-8 text-neutral-500">
        <div className="border-t pt-1">Accepted by / date</div>
        <div className="border-t pt-1">{s.name}</div>
      </div>
    </div>
  );
}
