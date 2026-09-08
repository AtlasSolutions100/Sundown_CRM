import type { AppData, Contract, Division, Job, Client, Property, TeamMember } from '@/data/types';
import { daysBetween, hoursBetween, sum } from './utils';
import { partSellPrice } from './pricing';

// ---------- Contract completion audit ----------

export type LineState = 'done' | 'scheduled' | 'due' | 'behind' | 'upcoming' | 'skipped';

export interface LineProgress {
  lineId: string;
  serviceId: string;
  label: string;
  windowStart: string;
  windowEnd: string;
  price: number;
  job?: Job;
  state: LineState;
  daysBehind: number;
  invoiceState: 'none' | 'pending' | 'sent' | 'paid' | 'overdue';
}

export interface ContractProgress {
  contract: Contract;
  client: Client;
  property: Property;
  lines: LineProgress[];
  total: number;
  done: number;
  behind: number;
  due: number;
  worstDaysBehind: number;
  status: 'on_track' | 'due' | 'behind' | 'complete';
  valueTotal: number;
  valueDone: number;
  valueRemaining: number;
  byService: { serviceId: string; name: string; done: number; total: number; behind: number }[];
}

export function contractProgress(d: AppData, contract: Contract): ContractProgress | null {
  const client = d.clients.find((c) => c.id === contract.clientId);
  const property = d.properties.find((p) => p.id === contract.propertyId);
  if (!client || !property) return null;
  const jobsByLine = new Map(d.jobs.filter((j) => j.contractLineId).map((j) => [j.contractLineId!, j]));
  const lines: LineProgress[] = contract.lines.map((line) => {
    const job = jobsByLine.get(line.id);
    let state: LineState = 'upcoming';
    let daysBehind = 0;
    if (job?.status === 'done') state = 'done';
    else if (job?.status === 'skipped') state = 'skipped';
    else if (job?.scheduledDate && job.status !== 'unscheduled') state = 'scheduled';
    else if (d.today > line.windowEnd) {
      state = 'behind';
      daysBehind = daysBetween(line.windowEnd, d.today);
    } else if (d.today >= line.windowStart) state = 'due';
    const inv = job?.invoiceId ? d.invoices.find((i) => i.id === job.invoiceId) : undefined;
    const invoiceState: LineProgress['invoiceState'] = !inv
      ? 'none'
      : inv.status === 'paid'
        ? 'paid'
        : inv.status === 'overdue'
          ? 'overdue'
          : inv.status === 'sent'
            ? 'sent'
            : 'pending';
    return { lineId: line.id, serviceId: line.serviceId, label: line.label, windowStart: line.windowStart, windowEnd: line.windowEnd, price: line.price, job, state, daysBehind, invoiceState };
  });
  const total = lines.length;
  const done = lines.filter((l) => l.state === 'done').length;
  const behind = lines.filter((l) => l.state === 'behind').length;
  const due = lines.filter((l) => l.state === 'due').length;
  const worstDaysBehind = Math.max(0, ...lines.map((l) => l.daysBehind));
  const status: ContractProgress['status'] = done === total ? 'complete' : behind > 0 ? 'behind' : due > 0 ? 'due' : 'on_track';
  const valueTotal = sum(lines.map((l) => l.price));
  const valueDone = sum(lines.filter((l) => l.state === 'done').map((l) => l.price));
  const byServiceMap = new Map<string, { serviceId: string; name: string; done: number; total: number; behind: number }>();
  for (const l of lines) {
    const svc = d.services.find((s) => s.id === l.serviceId);
    const entry = byServiceMap.get(l.serviceId) ?? { serviceId: l.serviceId, name: svc?.name ?? l.serviceId, done: 0, total: 0, behind: 0 };
    entry.total += 1;
    if (l.state === 'done') entry.done += 1;
    if (l.state === 'behind') entry.behind += 1;
    byServiceMap.set(l.serviceId, entry);
  }
  return { contract, client, property, lines, total, done, behind, due, worstDaysBehind, status, valueTotal, valueDone, valueRemaining: valueTotal - valueDone, byService: [...byServiceMap.values()] };
}

export function allContractProgress(d: AppData): ContractProgress[] {
  return d.contracts
    .filter((c) => c.status === 'active')
    .map((c) => contractProgress(d, c))
    .filter((x): x is ContractProgress => !!x)
    .sort((a, b) => b.worstDaysBehind - a.worstDaysBehind || b.behind - a.behind || b.due - a.due);
}

// ---------- Job costing / margins ----------

export interface MarginRow {
  key: string;
  label: string;
  revenue: number;
  laborHours: number;
  laborCost: number;
  materialCost: number;
  margin: number; // 0..1
  profit: number;
  realizedHourly: number;
  jobs: number;
}

function memberCost(d: AppData, memberId: string) {
  return d.team.find((m) => m.id === memberId)?.hourlyCost ?? 28;
}

/** Labor hours per property derived from geofence visits, split across the jobs worked during each visit. */
export function laborByJob(d: AppData): Map<string, { hours: number; cost: number }> {
  const out = new Map<string, { hours: number; cost: number }>();
  for (const te of d.timeEntries) {
    const rate = memberCost(d, te.memberId);
    for (const v of te.visits) {
      const hrs = hoursBetween(v.arrive, v.depart);
      const ids = v.jobIds.length ? v.jobIds : [`prop:${v.propertyId}`];
      const share = hrs / ids.length;
      for (const id of ids) {
        const cur = out.get(id) ?? { hours: 0, cost: 0 };
        cur.hours += share;
        cur.cost += share * rate;
        out.set(id, cur);
      }
    }
  }
  return out;
}

export function partsCost(d: AppData, usage: { partId: string; qty: number }[]) {
  return sum(usage.map((u) => (d.parts.find((p) => p.id === u.partId)?.cost ?? 0) * u.qty));
}

export function partsRevenue(d: AppData, usage: { partId: string; qty: number }[]) {
  return sum(
    usage.map((u) => {
      const p = d.parts.find((p) => p.id === u.partId);
      return p ? partSellPrice(p) * u.qty : 0;
    }),
  );
}

export function marginRows(d: AppData, groupKey: (j: Job) => { key: string; label: string } | null): MarginRow[] {
  const labor = laborByJob(d);
  const rows = new Map<string, MarginRow>();
  const doneJobs = d.jobs.filter((j) => j.status === 'done');
  for (const j of doneJobs) {
    const g = groupKey(j);
    if (!g) continue;
    const row = rows.get(g.key) ?? { key: g.key, label: g.label, revenue: 0, laborHours: 0, laborCost: 0, materialCost: 0, margin: 0, profit: 0, realizedHourly: 0, jobs: 0 };
    const lab = labor.get(j.id) ?? { hours: (j.laborMinutes ?? 0) / 60, cost: ((j.laborMinutes ?? 0) / 60) * 30 };
    row.revenue += j.price + partsRevenue(d, j.partsUsed);
    row.laborHours += lab.hours;
    row.laborCost += lab.cost;
    row.materialCost += partsCost(d, j.partsUsed);
    row.jobs += 1;
    rows.set(g.key, row);
  }
  for (const r of rows.values()) {
    r.profit = r.revenue - r.laborCost - r.materialCost;
    r.margin = r.revenue > 0 ? r.profit / r.revenue : 0;
    r.realizedHourly = r.laborHours > 0 ? (r.revenue - r.materialCost) / r.laborHours : 0;
  }
  return [...rows.values()].sort((a, b) => a.margin - b.margin);
}

export const DIVISION_LABEL: Record<Division, string> = {
  maintenance: 'Maintenance',
  irrigation: 'Irrigation',
  installs: 'Installs',
  backflow: 'Backflow',
};

export function marginByDivision(d: AppData) {
  return marginRows(d, (j) => ({ key: j.division, label: DIVISION_LABEL[j.division] }));
}

export function marginByClient(d: AppData) {
  return marginRows(d, (j) => {
    const c = d.clients.find((c) => c.id === j.clientId);
    return c ? { key: c.id, label: c.name } : null;
  });
}

export function marginByClientDivision(d: AppData, clientId: string) {
  return marginRows(d, (j) => (j.clientId === clientId ? { key: j.division, label: DIVISION_LABEL[j.division] } : null));
}

// ---------- Billable vs non-billable ----------

export function billableSplit(d: AppData, member: TeamMember, days = 14) {
  const entries = d.timeEntries.filter((t) => t.memberId === member.id && daysBetween(t.date, d.today) < days && t.clockOut);
  let total = 0;
  let billable = 0;
  for (const e of entries) {
    total += hoursBetween(e.clockIn, e.clockOut!);
    billable += sum(e.visits.map((v) => hoursBetween(v.arrive, v.depart)));
  }
  return { total, billable, nonBillable: Math.max(0, total - billable), ratio: total ? billable / total : 0 };
}

// ---------- Balances ----------

export function clientBalance(d: AppData, clientId: string) {
  const invs = d.invoices.filter((i) => i.clientId === clientId && (i.status === 'sent' || i.status === 'overdue'));
  const owed = sum(invs.map((i) => invoiceTotal(i)));
  const paid = sum(invs.map((i) => sum(d.payments.filter((p) => p.invoiceId === i.id).map((p) => p.amount))));
  return owed - paid;
}

export function invoiceTotal(i: { lines: { qty: number; unitPrice: number }[] }) {
  return Math.round(sum(i.lines.map((l) => l.qty * l.unitPrice)) * 100) / 100;
}

export function revenueThisMonth(d: AppData) {
  const ym = d.today.slice(0, 7);
  return sum(d.payments.filter((p) => p.date.startsWith(ym)).map((p) => p.amount));
}

export function revenueYtd(d: AppData) {
  const y = d.today.slice(0, 4);
  return sum(d.payments.filter((p) => p.date.startsWith(y)).map((p) => p.amount));
}
