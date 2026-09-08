import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, Invoice, InvoiceLine, Job, Role, TeamMember, Ticket, WorkOrder, TicketSource, Division } from './types';
import { buildSeed } from './seed';
import { uid, normalizePhone, hhmmToMinutes, addDaysIso } from '@/lib/utils';
import { partSellPrice, round2 } from '@/lib/pricing';

const STORAGE_KEY = 'sundown-crm-v4';
const ROLE_KEY = 'sundown-crm-role';

interface StoreValue {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  reset: () => void;
  role: Role;
  setRole: (r: Role) => void;
  currentUser: TeamMember;
  actions: ReturnType<typeof makeActions>;
}

const StoreContext = createContext<StoreValue | null>(null);

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.version === 4) return parsed;
    }
  } catch {
    /* ignore */
  }
  return buildSeed();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);
  const [role, setRoleState] = useState<Role>(() => {
    try {
      return (localStorage.getItem(ROLE_KEY) as Role) || 'owner';
    } catch {
      return 'owner';
    }
  });
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        /* ignore */
      }
    }, 250);
  }, [data]);

  const update = useCallback((fn: (d: AppData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setData(buildSeed());
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem(ROLE_KEY, r);
    } catch {
      /* ignore */
    }
  }, []);

  const currentUser = useMemo(() => {
    const byRole: Record<Role, string> = { owner: 'tm_david', ops: 'tm_marcus', foreman: 'tm_marcus', crew: 'tm_tyler' };
    return data.team.find((m) => m.id === byRole[role]) ?? data.team[0];
  }, [data.team, role]);

  const actions = useMemo(() => makeActions(update, () => currentUser), [update, currentUser]);

  const value = useMemo<StoreValue>(() => ({ data, update, reset, role, setRole, currentUser, actions }), [data, update, reset, role, setRole, currentUser, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}

// ---------------------------------------------------------------- lookups (pure helpers over data)
export function lookups(d: AppData) {
  const client = (id?: string) => d.clients.find((c) => c.id === id);
  const property = (id?: string) => d.properties.find((p) => p.id === id);
  const service = (id?: string) => d.services.find((s) => s.id === id);
  const member = (id?: string) => d.team.find((m) => m.id === id);
  const crew = (id?: string) => d.crews.find((c) => c.id === id);
  const part = (id?: string) => d.parts.find((p) => p.id === id);
  const purveyor = (id?: string) => d.purveyors.find((p) => p.id === id);
  const invoice = (id?: string) => d.invoices.find((i) => i.id === id);
  const ticket = (id?: string) => d.tickets.find((t) => t.id === id);
  const job = (id?: string) => d.jobs.find((j) => j.id === id);
  const estimate = (id?: string) => d.estimates.find((e) => e.id === id);
  return { client, property, service, member, crew, part, purveyor, invoice, ticket, job, estimate };
}

// ---------------------------------------------------------------- actions (business flows)
function nowIso(d: AppData) {
  const t = new Date();
  return `${d.today}T${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:00`;
}

function makeActions(update: (fn: (d: AppData) => void) => void, getUser: () => TeamMember) {
  const who = () => getUser().name;

  function buildInvoiceFromJob(d: AppData, job: Job): Invoice {
    const svc = d.services.find((s) => s.id === job.serviceId)!;
    const prop = d.properties.find((p) => p.id === job.propertyId)!;
    const lines: InvoiceLine[] = [{ id: uid('il'), description: `${svc.name} – ${prop.name} – ${job.scheduledDate ?? d.today}`, qty: 1, unitPrice: job.price, jobId: job.id }];
    for (const u of job.partsUsed) {
      const p = d.parts.find((p) => p.id === u.partId);
      if (p) lines.push({ id: uid('il'), description: p.name, qty: u.qty, unitPrice: partSellPrice(p), jobId: job.id });
    }
    return {
      id: uid('inv'),
      number: d.counters.invoice++,
      clientId: job.clientId,
      propertyId: job.propertyId,
      lines,
      status: 'pending_approval',
      createdAt: nowIso(d),
      dueDate: addDaysIso(d.today, 15),
      remindersSent: 0,
      autoGenerated: true,
      sourceLabel: `Auto: ${job.title}`,
      division: job.division,
    };
  }

  return {
    // ---- jobs
    setJobStatus(jobId: string, status: Job['status']) {
      update((d) => {
        const j = d.jobs.find((j) => j.id === jobId);
        if (!j) return;
        j.status = status;
        if (status === 'done') {
          j.completedAt = nowIso(d);
          if (!j.laborMinutes) j.laborMinutes = 45;
          // Non-routine work gets invoiced immediately; routine contract work rolls into the monthly auto-invoice.
          if (j.source !== 'contract' && !j.invoiceId) {
            const inv = buildInvoiceFromJob(d, j);
            d.invoices.push(inv);
            j.invoiceId = inv.id;
          }
          if (j.ticketId) {
            const t = d.tickets.find((t) => t.id === j.ticketId);
            if (t) {
              t.stage = 'complete';
              t.timeline.push({ at: nowIso(d), who: who(), text: 'Job marked complete.' });
            }
          }
        }
      });
    },
    scheduleJob(jobId: string, date: string, crewId: string) {
      update((d) => {
        const j = d.jobs.find((j) => j.id === jobId);
        if (!j) return;
        j.status = 'scheduled';
        j.scheduledDate = date;
        j.crewId = crewId;
        const sameDay = d.jobs.filter((x) => x.scheduledDate === date && x.crewId === crewId && x.id !== jobId);
        j.routeOrder = sameDay.length + 1;
        if (j.ticketId) {
          const t = d.tickets.find((t) => t.id === j.ticketId);
          if (t && ['new', 'needs_bid', 'bid_sent', 'approved'].includes(t.stage)) {
            t.stage = 'scheduled';
            t.timeline.push({ at: nowIso(d), who: who(), text: `Scheduled for ${date}.` });
          }
        }
      });
    },
    unscheduleJob(jobId: string) {
      update((d) => {
        const j = d.jobs.find((j) => j.id === jobId);
        if (!j) return;
        j.status = 'unscheduled';
        j.scheduledDate = undefined;
        j.routeOrder = undefined;
      });
    },
    setRouteOrder(date: string, crewId: string, orderedIds: string[]) {
      update((d) => {
        orderedIds.forEach((id, i) => {
          const j = d.jobs.find((j) => j.id === id);
          if (j && j.scheduledDate === date && j.crewId === crewId) j.routeOrder = i + 1;
        });
      });
    },
    addPartsToJob(jobId: string, parts: { partId: string; qty: number }[]) {
      update((d) => {
        const j = d.jobs.find((j) => j.id === jobId);
        if (!j) return;
        for (const p of parts) {
          const ex = j.partsUsed.find((x) => x.partId === p.partId);
          if (ex) ex.qty += p.qty;
          else j.partsUsed.push({ ...p });
        }
      });
    },
    weatherHold(jobId: string, hold: boolean) {
      update((d) => {
        const j = d.jobs.find((j) => j.id === jobId);
        if (j) j.status = hold ? 'weather_hold' : 'scheduled';
      });
    },

    // ---- tickets
    createTicket(input: { title: string; description: string; source: TicketSource; priority?: Ticket['priority']; clientId?: string; propertyId?: string; division?: Division; needsBid?: boolean; urgent?: boolean }) {
      let created: Ticket | undefined;
      update((d) => {
        const t: Ticket = {
          id: uid('tk'),
          number: d.counters.ticket++,
          clientId: input.clientId,
          propertyId: input.propertyId,
          title: input.title,
          description: input.description,
          source: input.source,
          priority: input.priority ?? (input.urgent ? 'urgent' : 'normal'),
          stage: input.needsBid ? 'needs_bid' : 'new',
          division: input.division ?? 'irrigation',
          createdAt: nowIso(d),
          createdBy: getUser().id,
          needsBid: !!input.needsBid,
          timeline: [{ at: nowIso(d), who: who(), text: `Created from ${input.source}.` }],
        };
        d.tickets.unshift(t);
        created = t;
      });
      return created;
    },
    setTicketStage(ticketId: string, stage: Ticket['stage'], note?: string) {
      update((d) => {
        const t = d.tickets.find((t) => t.id === ticketId);
        if (!t) return;
        t.stage = stage;
        t.timeline.push({ at: nowIso(d), who: who(), text: note ?? `Moved to ${stage.replace('_', ' ')}.` });
      });
    },
    assignTicket(ticketId: string, memberId: string) {
      update((d) => {
        const t = d.tickets.find((t) => t.id === ticketId);
        if (!t) return;
        t.assigneeId = memberId;
        const m = d.team.find((m) => m.id === memberId);
        t.timeline.push({ at: nowIso(d), who: who(), text: `Assigned to ${m?.name ?? memberId}.` });
      });
    },
    addTicketNote(ticketId: string, text: string) {
      update((d) => {
        const t = d.tickets.find((t) => t.id === ticketId);
        if (t) t.timeline.push({ at: nowIso(d), who: who(), text });
      });
    },
    /** Approve a ticket for T&M work (no bid) or after bid approval: creates the unscheduled job. */
    createJobFromTicket(ticketId: string, opts: { serviceId?: string; price?: number } = {}) {
      let jobId: string | undefined;
      update((d) => {
        const t = d.tickets.find((t) => t.id === ticketId);
        if (!t || !t.propertyId || !t.clientId) return;
        const svc = d.services.find((s) => s.id === (opts.serviceId ?? (t.division === 'maintenance' ? 'svc_prune' : t.division === 'installs' ? 'svc_install' : 'svc_irr_repair')))!;
        const est = t.estimateId ? d.estimates.find((e) => e.id === t.estimateId) : undefined;
        const price = opts.price ?? (est ? round2(est.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)) : svc.pricing.tripFee + (svc.pricing.hourlyRate ?? 0));
        const j: Job = {
          id: uid('job'),
          propertyId: t.propertyId,
          clientId: t.clientId,
          serviceId: svc.id,
          division: t.division,
          title: t.title,
          source: est ? 'estimate' : 'ticket',
          ticketId: t.id,
          estimateId: est?.id,
          status: 'unscheduled',
          windowStart: d.today,
          windowEnd: addDaysIso(d.today, 7),
          price,
          partsUsed: [],
          notes: t.description,
          urgent: t.priority === 'urgent',
        };
        d.jobs.push(j);
        t.jobId = j.id;
        t.stage = 'approved';
        t.timeline.push({ at: nowIso(d), who: who(), text: `Approved – job created (${svc.name}).` });
        jobId = j.id;
      });
      return jobId;
    },

    // ---- estimates
    sendEstimate(estimateId: string) {
      update((d) => {
        const e = d.estimates.find((e) => e.id === estimateId);
        if (!e) return;
        e.status = 'sent';
        e.sentAt = nowIso(d);
        const t = d.tickets.find((t) => t.id === e.ticketId);
        if (t) {
          t.stage = 'bid_sent';
          t.timeline.push({ at: nowIso(d), who: who(), text: `Estimate #${e.number} sent.` });
        }
        const c = d.clients.find((c) => c.id === e.clientId);
        if (c) d.messages.unshift({ id: uid('m'), clientId: c.id, propertyId: e.propertyId, direction: 'out', channel: 'email', from: 'service@sundownlawnandirrigation.com', to: c.email, body: `Estimate #${e.number} – ${e.title}. Total ${e.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0).toFixed(2)}. Approve online or reply APPROVED.`, at: nowIso(d), ticketId: e.ticketId, read: true });
      });
    },
    approveEstimate(estimateId: string) {
      update((d) => {
        const e = d.estimates.find((e) => e.id === estimateId);
        if (!e) return;
        e.status = 'approved';
        e.approvedAt = nowIso(d);
        const t = d.tickets.find((t) => t.id === e.ticketId);
        if (t) {
          t.stage = 'approved';
          t.timeline.push({ at: nowIso(d), who: who(), text: `Client approved estimate #${e.number}.` });
        }
        const c = d.clients.find((c) => c.id === e.clientId);
        if (c && c.status === 'lead') c.status = 'active';
      });
    },

    // ---- work orders
    submitWorkOrder(wo: Omit<WorkOrder, 'id' | 'number' | 'status' | 'invoiceId'>) {
      update((d) => {
        const rec: WorkOrder = { ...wo, id: uid('wo'), number: d.counters.workOrder++, status: 'submitted' };
        d.workOrders.unshift(rec);
        const mins = Math.max(15, hhmmToMinutes(wo.timeOut) - hhmmToMinutes(wo.timeIn));
        const hours = round2(mins / 60);
        const prop = d.properties.find((p) => p.id === wo.propertyId)!;
        const tech = d.team.find((m) => m.id === wo.techId);
        const lines: InvoiceLine[] = [
          { id: uid('il'), description: `Service call / trip fee – ${prop.name} – ${wo.date}`, qty: 1, unitPrice: 45, workOrderId: rec.id },
          { id: uid('il'), description: `Irrigation labor (${tech?.name ?? 'tech'})`, qty: hours, unitPrice: wo.laborRate, workOrderId: rec.id },
        ];
        for (const u of wo.parts) {
          const p = d.parts.find((p) => p.id === u.partId);
          if (p) lines.push({ id: uid('il'), description: p.name, qty: u.qty, unitPrice: partSellPrice(p), workOrderId: rec.id });
        }
        const inv: Invoice = {
          id: uid('inv'),
          number: d.counters.invoice++,
          clientId: wo.clientId,
          propertyId: wo.propertyId,
          lines,
          status: 'pending_approval',
          createdAt: nowIso(d),
          dueDate: addDaysIso(d.today, 15),
          remindersSent: 0,
          autoGenerated: true,
          sourceLabel: `Auto: Work order #${rec.number}`,
          division: 'irrigation',
        };
        d.invoices.unshift(inv);
        rec.invoiceId = inv.id;
        if (wo.jobId) {
          const j = d.jobs.find((j) => j.id === wo.jobId);
          if (j) {
            j.status = 'done';
            j.completedAt = nowIso(d);
            j.laborMinutes = mins;
            j.partsUsed = wo.parts.map((p) => ({ ...p }));
            j.invoiceId = inv.id;
          }
        }
        if (wo.ticketId) {
          const t = d.tickets.find((t) => t.id === wo.ticketId);
          if (t) {
            t.stage = 'complete';
            t.timeline.push({ at: nowIso(d), who: who(), text: `Work order #${rec.number} submitted. Invoice #${inv.number} drafted – awaiting approval.` });
          }
        }
        // Existing open WO for same job gets superseded
        d.workOrders = d.workOrders.filter((w) => !(w.status === 'open' && w.jobId && w.jobId === wo.jobId && w.id !== rec.id));
      });
    },

    // ---- invoices
    approveInvoice(invoiceId: string) {
      update((d) => {
        const i = d.invoices.find((i) => i.id === invoiceId);
        if (!i) return;
        i.status = 'sent';
        i.sentAt = nowIso(d);
        i.dueDate = addDaysIso(d.today, 15);
        d.settings.invoiceApprovalsCount += 1;
        for (const l of i.lines) {
          const wo = l.workOrderId ? d.workOrders.find((w) => w.id === l.workOrderId) : undefined;
          if (wo) wo.status = 'invoiced';
          const t = wo?.ticketId ? d.tickets.find((t) => t.id === wo.ticketId) : undefined;
          if (t && t.stage === 'complete') {
            t.stage = 'invoiced';
            t.timeline.push({ at: nowIso(d), who: who(), text: `Invoice #${i.number} approved & sent.` });
          }
        }
        const c = d.clients.find((c) => c.id === i.clientId);
        if (c) d.messages.unshift({ id: uid('m'), clientId: c.id, direction: 'out', channel: 'email', from: 'billing@sundownlawnandirrigation.com', to: c.billingEmail ?? c.email, body: `Invoice #${i.number} – ${i.sourceLabel.replace('Auto: ', '')}. Due ${i.dueDate}. Pay online or mail a check.`, at: nowIso(d), read: true });
      });
    },
    voidInvoice(invoiceId: string) {
      update((d) => {
        const i = d.invoices.find((i) => i.id === invoiceId);
        if (i) i.status = 'void';
      });
    },
    recordPayment(invoiceId: string, amount: number, method: 'check' | 'card' | 'ach' | 'cash' | 'venmo', reference?: string) {
      update((d) => {
        const i = d.invoices.find((i) => i.id === invoiceId);
        if (!i) return;
        d.payments.unshift({ id: uid('pay'), invoiceId, amount, method, date: d.today, reference });
        const total = i.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
        const paid = d.payments.filter((p) => p.invoiceId === invoiceId).reduce((s, p) => s + p.amount, 0);
        if (paid >= total - 0.005) {
          i.status = 'paid';
          i.paidAt = d.today;
          for (const l of i.lines) {
            const wo = l.workOrderId ? d.workOrders.find((w) => w.id === l.workOrderId) : undefined;
            const t = wo?.ticketId ? d.tickets.find((t) => t.id === wo.ticketId) : undefined;
            if (t && t.stage === 'invoiced') {
              t.stage = 'closed';
              t.timeline.push({ at: nowIso(d), who: 'System', text: `Paid (${method}${reference ? ` ${reference}` : ''}). Ticket closed.` });
            }
          }
        }
      });
    },
    sendReminder(invoiceId: string) {
      update((d) => {
        const i = d.invoices.find((i) => i.id === invoiceId);
        if (!i) return;
        i.remindersSent += 1;
        const c = d.clients.find((c) => c.id === i.clientId);
        if (c) d.messages.unshift({ id: uid('m'), clientId: c.id, direction: 'out', channel: 'email', from: 'billing@sundownlawnandirrigation.com', to: c.billingEmail ?? c.email, body: `Reminder: invoice #${i.number} is past due. Pay online or reply with questions.`, at: nowIso(d), read: true });
      });
    },
    setInvoiceAutoSend(on: boolean) {
      update((d) => {
        d.settings.invoiceAutoSend = on;
      });
    },
    /** Month-end auto-invoice run: bundles every completed, un-invoiced contract job per client. */
    runMonthlyInvoicing() {
      let count = 0;
      update((d) => {
        const byClient = new Map<string, Job[]>();
        for (const j of d.jobs) {
          if (j.status === 'done' && j.source === 'contract' && !j.invoiceId) (byClient.get(j.clientId) ?? byClient.set(j.clientId, []).get(j.clientId)!).push(j);
        }
        for (const [clientId, list] of byClient) {
          const lines: InvoiceLine[] = list
            .sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''))
            .map((j) => {
              const svc = d.services.find((s) => s.id === j.serviceId)!;
              const prop = d.properties.find((p) => p.id === j.propertyId)!;
              return { id: uid('il'), description: `${svc.name} – ${prop.name} – ${j.scheduledDate}`, qty: 1, unitPrice: j.price, jobId: j.id };
            });
          const inv: Invoice = {
            id: uid('inv'),
            number: d.counters.invoice++,
            clientId,
            lines,
            status: d.settings.invoiceAutoSend ? 'sent' : 'pending_approval',
            createdAt: nowIso(d),
            sentAt: d.settings.invoiceAutoSend ? nowIso(d) : undefined,
            dueDate: addDaysIso(d.today, 15),
            remindersSent: 0,
            autoGenerated: true,
            sourceLabel: `Auto: September to date – ${list.length} completed visits`,
            division: 'maintenance',
          };
          d.invoices.unshift(inv);
          for (const j of list) j.invoiceId = inv.id;
          count++;
        }
      });
      return count;
    },

    // ---- backflow
    recordBackflowTest(test: Omit<import('./types').BackflowTest, 'id'>) {
      update((d) => {
        d.backflowTests.unshift({ ...test, id: uid('bt') });
      });
    },
    sendBackflowReports(testIds: string[]) {
      update((d) => {
        for (const id of testIds) {
          const t = d.backflowTests.find((t) => t.id === id);
          if (t) t.sentToPurveyorAt = nowIso(d);
        }
        const first = d.backflowTests.find((t) => t.id === testIds[0]);
        const dev = first ? d.backflowDevices.find((x) => x.id === first.deviceId) : undefined;
        const pv = dev ? d.purveyors.find((p) => p.id === dev.purveyorId) : undefined;
        const prop = dev ? d.properties.find((p) => p.id === dev.propertyId) : undefined;
        if (pv && prop) d.messages.unshift({ id: uid('m'), clientId: prop.clientId, propertyId: prop.id, direction: 'out', channel: 'email', from: 'backflow@sundownlawnandirrigation.com', to: pv.email, body: `Backflow test report(s) for ${prop.address} – ${testIds.length} device(s). Tester license attached.`, at: nowIso(d), read: true });
      });
    },

    // ---- inbox
    fileMessage(messageId: string, clientId: string, remember: boolean) {
      update((d) => {
        const m = d.messages.find((m) => m.id === messageId);
        if (!m) return;
        m.clientId = clientId;
        m.read = true;
        const prop = d.properties.find((p) => p.clientId === clientId);
        m.propertyId = prop?.id;
        if (remember) {
          const key = m.from.includes('@') ? m.from.toLowerCase() : normalizePhone(m.from);
          d.knownContacts[key] = clientId;
          const c = d.clients.find((c) => c.id === clientId);
          if (c && !m.from.includes('@') && !c.altPhones.includes(m.from) && normalizePhone(c.phone) !== key) c.altPhones.push(m.from);
        }
      });
    },
    markRead(messageId: string) {
      update((d) => {
        const m = d.messages.find((m) => m.id === messageId);
        if (m) m.read = true;
      });
    },
    sendMessage(clientId: string, channel: 'text' | 'email', body: string) {
      update((d) => {
        const c = d.clients.find((c) => c.id === clientId);
        if (!c) return;
        d.messages.unshift({ id: uid('m'), clientId, direction: 'out', channel, from: channel === 'text' ? d.settings.serviceLine : d.settings.email, to: channel === 'text' ? c.phone : c.email, body, at: nowIso(d), read: true });
      });
    },
    createClientFromMessage(messageId: string, name: string) {
      let clientId = '';
      update((d) => {
        const m = d.messages.find((m) => m.id === messageId);
        if (!m) return;
        clientId = uid('cl');
        const isEmail = m.from.includes('@');
        d.clients.unshift({ id: clientId, name, type: 'residential', status: 'lead', contactName: name, phone: isEmail ? '' : m.from, altPhones: [], email: isEmail ? m.from : '', address: '', notes: `Created from inbound ${m.channel}.`, tags: ['Lead'], termYears: 1, contractSince: '', createdAt: d.today });
        m.clientId = clientId;
        m.read = true;
        d.knownContacts[isEmail ? m.from.toLowerCase() : normalizePhone(m.from)] = clientId;
      });
      return clientId;
    },

    // ---- time
    clockIn(memberId: string) {
      update((d) => {
        const ex = d.timeEntries.find((t) => t.memberId === memberId && t.date === d.today);
        if (ex) return;
        d.timeEntries.push({ id: uid('te'), memberId, date: d.today, clockIn: nowIso(d), visits: [], syncedToQuickBooks: false });
      });
    },
    clockOut(memberId: string) {
      update((d) => {
        const ex = d.timeEntries.find((t) => t.memberId === memberId && t.date === d.today);
        if (ex) ex.clockOut = nowIso(d);
      });
    },
    syncQuickBooks() {
      let n = 0;
      update((d) => {
        for (const t of d.timeEntries) {
          if (!t.syncedToQuickBooks && t.clockOut) {
            t.syncedToQuickBooks = true;
            n++;
          }
        }
      });
      return n;
    },

    // ---- parts
    updatePart(partId: string, patch: Partial<import('./types').Part>) {
      update((d) => {
        const p = d.parts.find((p) => p.id === partId);
        if (p) Object.assign(p, patch);
      });
    },
    bulkMarkup(pct: number) {
      update((d) => {
        for (const p of d.parts) p.markupPct = pct;
        d.settings.defaultMarkupPct = pct;
      });
    },
  };
}
