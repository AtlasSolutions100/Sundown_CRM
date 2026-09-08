import { useMemo, useState } from 'react';
import { Receipt, ShieldCheck, Play, Send, Ban, CreditCard, BellRing, Eye, Printer } from 'lucide-react';
import { useStore } from '@/data/store';
import type { Invoice, InvoiceStatus, Payment } from '@/data/types';
import { Button, Card, CardContent, Badge, Input, Select, Field, Dialog, Tabs, Progress, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, EmptyState, useToast, Switch } from '@/components/ui';
import { useLookups, InvoiceStatusBadge, ClientLink } from '@/components/shared';
import { invoiceTotal, revenueThisMonth, revenueYtd } from '@/lib/metrics';
import { money, fmtDate, fmtDateLong, cn, sum } from '@/lib/utils';

type TabKey = 'pending' | 'sent' | 'overdue' | 'paid' | 'all';

const STATUS_RANK: Record<InvoiceStatus, number> = { overdue: 0, pending_approval: 1, sent: 2, paid: 3, void: 4 };

export default function Invoices() {
  const { data, actions, update } = useStore();
  const { client } = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('pending');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const invoices = data.invoices;
  const pending = invoices.filter((i) => i.status === 'pending_approval');
  const sent = invoices.filter((i) => i.status === 'sent');
  const overdue = invoices.filter((i) => i.status === 'overdue');
  const paid = invoices.filter((i) => i.status === 'paid');

  const paidOn = (inv: Invoice) => sum(data.payments.filter((p) => p.invoiceId === inv.id).map((p) => p.amount));
  const remaining = (inv: Invoice) => Math.max(0, invoiceTotal(inv) - paidOn(inv));

  const rows = useMemo(() => {
    const list = tab === 'pending' ? pending : tab === 'sent' ? sent : tab === 'overdue' ? overdue : tab === 'paid' ? paid : invoices;
    return [...list].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.createdAt.localeCompare(a.createdAt));
  }, [tab, invoices, pending, sent, overdue, paid]);

  const trustPct = Math.min(1, data.settings.invoiceApprovalsCount / data.settings.invoiceApprovalsToTrust);
  const reviewInv = invoices.find((i) => i.id === reviewId);
  const payInv = invoices.find((i) => i.id === payId);
  const viewInv = invoices.find((i) => i.id === viewId);

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Invoices"
        subtitle="Auto-generated from completed work. Nothing goes out until you approve it, until you tell it to."
        actions={
          <Button
            variant="accent"
            onClick={() => {
              const n = actions.runMonthlyInvoicing();
              toast(n ? { title: `${n} invoice${n === 1 ? '' : 's'} drafted`, description: data.settings.invoiceAutoSend ? 'Sent automatically.' : 'Waiting in the approval queue.' } : { title: 'Nothing to invoice', description: 'Every completed contract visit is already on an invoice.', tone: 'info' });
            }}
          >
            <Play /> Run month-end invoicing now
          </Button>
        }
      />

      {/* Trust banner */}
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              Automation trust: {data.settings.invoiceApprovalsCount} of {data.settings.invoiceApprovalsToTrust} auto-invoices approved without edits
            </div>
            <p className="text-sm text-muted-foreground">You stay in the loop while the system earns it. Once you have clicked "looks good" enough times, flip the switch and it sends on its own.</p>
            <Progress value={trustPct} className="mt-2" tone={trustPct >= 1 ? 'success' : 'primary'} />
          </div>
          <div className="shrink-0 rounded-md border bg-card px-3 py-2">
            <Switch
              checked={data.settings.invoiceAutoSend}
              onChange={(v) => {
                actions.setInvoiceAutoSend(v);
                toast(v ? { title: 'Auto-send on', description: 'New auto-invoices will send without approval.', tone: 'warning' } : { title: 'Auto-send off', description: 'Auto-invoices will wait for your approval.' });
              }}
              label="Auto-send without asking me"
            />
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Needs approval" value={pending.length} sub={money(sum(pending.map(invoiceTotal)))} tone={pending.length ? 'accent' : 'default'} icon={<Receipt />} onClick={() => setTab('pending')} />
        <Stat label="Outstanding" value={money(sum([...sent, ...overdue].map(remaining)))} sub={`${sent.length + overdue.length} invoices sent`} onClick={() => setTab('sent')} />
        <Stat label="Overdue" value={overdue.length} sub={money(sum(overdue.map(remaining)))} tone={overdue.length ? 'danger' : 'default'} onClick={() => setTab('overdue')} />
        <Stat label="Collected MTD" value={money(revenueThisMonth(data), { cents: false })} sub="September" tone="success" />
        <Stat label="Collected YTD" value={money(revenueYtd(data), { cents: false })} sub="2026 season" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'pending', label: 'Needs approval', count: pending.length },
          { value: 'sent', label: 'Sent', count: sent.length },
          { value: 'overdue', label: 'Overdue', count: overdue.length },
          { value: 'paid', label: 'Paid', count: paid.length },
          { value: 'all', label: 'All', count: invoices.length },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Receipt />} title="Nothing here" description={tab === 'pending' ? 'No invoices waiting on you. Completed work will show up here automatically.' : 'No invoices in this view.'} />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Client</TH>
                <TH>Source</TH>
                <TH>Created</TH>
                <TH>Due</TH>
                <TH className="text-right">Total</TH>
                <TH>Status</TH>
                <TH className="text-center">Reminders</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((inv) => (
                <TR key={inv.id} className={cn(inv.status === 'overdue' && 'bg-destructive/5')}>
                  <TD className="font-mono text-xs">{inv.number}</TD>
                  <TD>
                    <ClientLink id={inv.clientId} />
                  </TD>
                  <TD className="max-w-[320px]">
                    <div className="flex items-center gap-2">
                      {inv.autoGenerated && <Badge tone="primary">Auto</Badge>}
                      <span className="truncate text-sm text-muted-foreground" title={inv.sourceLabel}>
                        {inv.sourceLabel.replace(/^Auto: /, '')}
                      </span>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">{fmtDate(inv.createdAt)}</TD>
                  <TD className="whitespace-nowrap">{fmtDate(inv.dueDate)}</TD>
                  <TD className="text-right font-medium tabular">{money(invoiceTotal(inv))}</TD>
                  <TD>
                    <InvoiceStatusBadge status={inv.status} />
                  </TD>
                  <TD className="text-center tabular">{inv.remindersSent || '—'}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      {inv.status === 'pending_approval' && (
                        <Button size="xs" variant="accent" onClick={() => setReviewId(inv.id)}>
                          <Eye /> Review
                        </Button>
                      )}
                      {(inv.status === 'sent' || inv.status === 'overdue') && (
                        <>
                          <Button size="xs" variant="outline" onClick={() => setPayId(inv.id)}>
                            <CreditCard /> Record payment
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              actions.sendReminder(inv.id);
                              toast({ title: `Reminder sent for #${inv.number}`, description: client(inv.clientId)?.name });
                            }}
                          >
                            <BellRing /> Remind
                          </Button>
                        </>
                      )}
                      {(inv.status === 'paid' || inv.status === 'void') && (
                        <Button size="xs" variant="ghost" onClick={() => setViewId(inv.id)}>
                          <Eye /> View
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {reviewInv && (
        <ReviewDialog
          inv={reviewInv}
          onClose={() => setReviewId(null)}
          onEditLine={(lineId, patch) =>
            update((d) => {
              const i = d.invoices.find((x) => x.id === reviewInv.id);
              const l = i?.lines.find((x) => x.id === lineId);
              if (l) Object.assign(l, patch);
            })
          }
          onApprove={() => {
            actions.approveInvoice(reviewInv.id);
            toast({ title: `Invoice #${reviewInv.number} approved & sent`, description: `${client(reviewInv.clientId)?.name} · ${money(invoiceTotal(reviewInv))}` });
            setReviewId(null);
          }}
          onVoid={() => {
            actions.voidInvoice(reviewInv.id);
            toast({ title: `Invoice #${reviewInv.number} voided`, tone: 'warning' });
            setReviewId(null);
          }}
        />
      )}

      {payInv && (
        <PaymentDialog
          inv={payInv}
          remaining={remaining(payInv)}
          onClose={() => setPayId(null)}
          onSubmit={(amount, method, reference) => {
            actions.recordPayment(payInv.id, amount, method, reference || undefined);
            toast({ title: `Payment recorded`, description: `${money(amount)} on #${payInv.number}${amount >= remaining(payInv) - 0.005 ? ' · paid in full' : ''}` });
            setPayId(null);
          }}
        />
      )}

      {viewInv && (
        <Dialog open onClose={() => setViewId(null)} title={`Invoice #${viewInv.number}`} description={viewInv.sourceLabel} size="lg" footer={<Button variant="outline" onClick={() => setViewId(null)}>Close</Button>}>
          <InvoicePreview inv={viewInv} />
          {data.payments.filter((p) => p.invoiceId === viewInv.id).length > 0 && (
            <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</div>
              {data.payments
                .filter((p) => p.invoiceId === viewInv.id)
                .map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>
                      {fmtDateLong(p.date)} · {p.method.toUpperCase()} {p.reference ?? ''}
                    </span>
                    <span className="tabular font-medium">{money(p.amount)}</span>
                  </div>
                ))}
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Review dialog
function ReviewDialog({ inv, onClose, onEditLine, onApprove, onVoid }: { inv: Invoice; onClose: () => void; onEditLine: (lineId: string, patch: { qty?: number; unitPrice?: number; description?: string }) => void; onApprove: () => void; onVoid: () => void }) {
  const { client, property } = useLookups();
  const [preview, setPreview] = useState(false);
  const c = client(inv.clientId);
  const p = property(inv.propertyId);
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Review invoice #${inv.number}`}
      description={
        <span>
          {c?.name}
          {p ? ` · ${p.name}` : ''} · {inv.sourceLabel}
        </span>
      }
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => setPreview((v) => !v)}>
            <Printer /> {preview ? 'Back to edit' : 'Preview'}
          </Button>
          <Button variant="outline" onClick={onVoid}>
            <Ban /> Void
          </Button>
          <Button variant="success" onClick={onApprove}>
            <Send /> Approve & send
          </Button>
        </>
      }
    >
      {preview ? (
        <InvoicePreview inv={inv} />
      ) : (
        <>
          <div className="mb-3 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">
            Does this look right? Edit any quantity or price inline. Approving sends it to <span className="font-medium">{c?.billingEmail ?? c?.email}</span> and counts toward automation trust.
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Description</TH>
                <TH className="w-24 text-right">Qty</TH>
                <TH className="w-28 text-right">Unit price</TH>
                <TH className="w-28 text-right">Total</TH>
              </TR>
            </THead>
            <TBody>
              {inv.lines.map((l) => (
                <TR key={l.id}>
                  <TD>
                    <Input value={l.description} onChange={(e) => onEditLine(l.id, { description: e.target.value })} className="h-8" />
                  </TD>
                  <TD>
                    <Input type="number" step="0.25" min={0} value={l.qty} onChange={(e) => onEditLine(l.id, { qty: Number(e.target.value) })} className="h-8 w-20 px-2 text-right tabular" />
                  </TD>
                  <TD>
                    <Input type="number" step="0.01" min={0} value={l.unitPrice} onChange={(e) => onEditLine(l.id, { unitPrice: Number(e.target.value) })} className="h-8 w-24 px-2 text-right tabular" />
                  </TD>
                  <TD className="text-right font-medium tabular">{money(l.qty * l.unitPrice)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Due {fmtDateLong(inv.dueDate)} · Net 15</span>
            <span className="text-lg font-bold tabular">{money(invoiceTotal(inv))}</span>
          </div>
        </>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- Payment dialog
function PaymentDialog({ inv, remaining, onClose, onSubmit }: { inv: Invoice; remaining: number; onClose: () => void; onSubmit: (amount: number, method: Payment['method'], reference: string) => void }) {
  const { client } = useLookups();
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [method, setMethod] = useState<Payment['method']>('check');
  const [reference, setReference] = useState('');
  const amt = Number(amount);
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Record payment · #${inv.number}`}
      description={`${client(inv.clientId)?.name} · ${money(remaining)} remaining`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!(amt > 0)} onClick={() => onSubmit(amt, method, reference)}>
            <CreditCard /> Record {amt > 0 ? money(amt) : ''}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Amount">
          <Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
        </Field>
        <Field label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as Payment['method'])}>
            <option value="check">Check</option>
            <option value="card">Card</option>
            <option value="ach">ACH</option>
            <option value="cash">Cash</option>
            <option value="venmo">Venmo</option>
          </Select>
        </Field>
        <Field label="Reference" hint="Check number, last 4, or confirmation">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="#4471" />
        </Field>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Printable preview
function InvoicePreview({ inv }: { inv: Invoice }) {
  const { data } = useStore();
  const { client, property } = useLookups();
  const c = client(inv.clientId);
  const p = property(inv.propertyId);
  const s = data.settings;
  return (
    <div className="rounded-lg border bg-white p-6 text-[13px] text-neutral-900 shadow-inner">
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <div className="text-lg font-bold">{s.name}</div>
          <div className="text-neutral-600">
            {s.address}
            <br />
            {s.city}
            <br />
            {s.serviceLine} · {s.email}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tracking-tight">INVOICE</div>
          <div className="text-neutral-600">#{inv.number}</div>
          <div className="text-neutral-600">Issued {fmtDateLong(inv.sentAt ?? inv.createdAt)}</div>
          <div className="font-medium">Due {fmtDateLong(inv.dueDate)}</div>
        </div>
      </div>
      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Bill to</div>
          <div className="font-medium">{c?.name}</div>
          <div className="text-neutral-600">
            {c?.contactName}
            <br />
            {c?.address}
            <br />
            {c?.billingEmail ?? c?.email}
          </div>
        </div>
        {p && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Service location</div>
            <div className="font-medium">{p.name}</div>
            <div className="text-neutral-600">
              {p.address}, {p.city}
            </div>
          </div>
        )}
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-[10px] uppercase tracking-wider text-neutral-500">
            <th className="py-1">Description</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id} className="border-b border-neutral-100">
              <td className="py-1.5">{l.description}</td>
              <td className="py-1.5 text-right tabular">{l.qty}</td>
              <td className="py-1.5 text-right tabular">{money(l.unitPrice)}</td>
              <td className="py-1.5 text-right tabular">{money(l.qty * l.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end">
        <div className="w-56 space-y-1">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span className="tabular">{money(invoiceTotal(inv))}</span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Tax ({(s.taxRate * 100).toFixed(0)}%)</span>
            <span className="tabular">{money(invoiceTotal(inv) * s.taxRate)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <span>Total due</span>
            <span className="tabular">{money(invoiceTotal(inv) * (1 + s.taxRate))}</span>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-[11px] text-neutral-500">Thank you for choosing {s.name}. Pay online, by check, or ACH. Questions? Call {s.serviceLine}.</p>
    </div>
  );
}
