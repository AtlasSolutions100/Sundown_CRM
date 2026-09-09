import { Link } from 'wouter';
import { Phone, MessageSquare, Mail, Mic, Globe, HardHat, type LucideIcon } from 'lucide-react';
import { Badge, type Tone } from './ui';
import { useStore, lookups } from '@/data/store';
import type { AppData, Division, InvoiceStatus, JobStatus, Ticket, TicketSource, TicketStage } from '@/data/types';
import { DIVISION_LABEL } from '@/lib/metrics';
import { cn, titleCase } from '@/lib/utils';

export function useLookups() {
  const { data } = useStore();
  return lookups(data);
}

// ---- Job status
const JOB_TONE: Record<JobStatus, Tone> = { unscheduled: 'outline', scheduled: 'info', en_route: 'accent', in_progress: 'accent', done: 'success', skipped: 'neutral', weather_hold: 'warning' };
const JOB_LABEL: Record<JobStatus, string> = { unscheduled: 'Unscheduled', scheduled: 'Scheduled', en_route: 'En route', in_progress: 'In progress', done: 'Done', skipped: 'Skipped', weather_hold: 'Weather hold' };
export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return <Badge tone={JOB_TONE[status]} dot className={className}>{JOB_LABEL[status]}</Badge>;
}

// ---- Ticket stage
export const STAGES: { value: TicketStage; label: string; tone: Tone }[] = [
  { value: 'new', label: 'New', tone: 'accent' },
  { value: 'needs_bid', label: 'Needs Bid', tone: 'warning' },
  { value: 'bid_sent', label: 'Bid Sent', tone: 'info' },
  { value: 'approved', label: 'Approved', tone: 'primary' },
  { value: 'scheduled', label: 'Scheduled', tone: 'info' },
  { value: 'complete', label: 'Complete', tone: 'success' },
  { value: 'invoiced', label: 'Invoiced', tone: 'success' },
  { value: 'closed', label: 'Paid / Closed', tone: 'neutral' },
];
export function TicketStageBadge({ stage }: { stage: TicketStage }) {
  const s = STAGES.find((x) => x.value === stage)!;
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function ticketPipeline(t: Ticket, d: AppData): { label: string; state: 'done' | 'active' | 'todo' | 'skipped' | 'warn' }[] {
  const order: TicketStage[] = t.needsBid ? ['new', 'needs_bid', 'bid_sent', 'approved', 'scheduled', 'complete', 'invoiced', 'closed'] : ['new', 'approved', 'scheduled', 'complete', 'invoiced', 'closed'];
  const labels: Record<TicketStage, string> = { new: 'Logged', needs_bid: 'Bid', bid_sent: 'Sent', approved: 'Approved', scheduled: 'Sched.', complete: 'Done', invoiced: 'Invoiced', closed: 'Paid' };
  const idx = order.indexOf(t.stage);
  const inv = t.jobId ? d.invoices.find((i) => i.id === d.jobs.find((j) => j.id === t.jobId)?.invoiceId) : undefined;
  return order.map((s, i) => {
    let state: 'done' | 'active' | 'todo' | 'warn' = i < idx ? 'done' : i === idx ? 'active' : 'todo';
    if (s === 'invoiced' && inv?.status === 'overdue') state = 'warn';
    if (s === 'closed' && t.stage === 'closed') state = 'done';
    return { label: labels[s], state };
  });
}

// ---- Invoice status
const INV_TONE: Record<InvoiceStatus, Tone> = { pending_approval: 'accent', sent: 'info', paid: 'success', overdue: 'danger', void: 'neutral' };
const INV_LABEL: Record<InvoiceStatus, string> = { pending_approval: 'Needs approval', sent: 'Sent', paid: 'Paid', overdue: 'Overdue', void: 'Void' };
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={INV_TONE[status]} dot>{INV_LABEL[status]}</Badge>;
}

// ---- Division
const DIV_TONE: Record<Division, Tone> = { maintenance: 'success', irrigation: 'info', installs: 'accent', backflow: 'primary' };
export function DivisionBadge({ division }: { division: Division }) {
  return <Badge tone={DIV_TONE[division]}>{DIVISION_LABEL[division]}</Badge>;
}

// ---- Priority
export function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  if (priority === 'urgent') return <Badge tone="danger" dot>Urgent</Badge>;
  if (priority === 'low') return <Badge tone="outline">Low</Badge>;
  return null;
}

// ---- Source icon
const SOURCE_ICON: Record<TicketSource, LucideIcon> = { call: Phone, text: MessageSquare, email: Mail, field: HardHat, voice: Mic, web: Globe };
export function SourceIcon({ source, className }: { source: TicketSource; className?: string }) {
  const I = SOURCE_ICON[source];
  return (
    <span title={titleCase(source)} className={cn('inline-flex size-5 items-center justify-center text-muted-foreground', className)}>
      <I className="size-4" strokeWidth={1.9} />
    </span>
  );
}

// ---- Links
export function ClientLink({ id, className }: { id?: string; className?: string }) {
  const { client } = useLookups();
  const c = client(id);
  if (!c) return <span className="text-muted-foreground">Unassigned</span>;
  return (
    <Link href={`/clients/${c.id}`} className={cn('font-medium text-foreground hover:text-primary hover:underline', className)}>
      {c.name}
    </Link>
  );
}
export function PropertyLabel({ id, withAddress }: { id?: string; withAddress?: boolean }) {
  const { property } = useLookups();
  const p = property(id);
  if (!p) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {p.name}
      {withAddress && <span className="text-muted-foreground"> · {p.address}, {p.city}</span>}
    </span>
  );
}

export function CrewChip({ crewId }: { crewId?: string }) {
  const { crew } = useLookups();
  const c = crew(crewId);
  if (!c) return <span className="text-xs text-muted-foreground">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="size-2 rounded-full" style={{ background: `hsl(${c.color})` }} />
      {c.name}
    </span>
  );
}

export function StatePill({ state }: { state: 'done' | 'scheduled' | 'due' | 'behind' | 'upcoming' | 'skipped' }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    done: { tone: 'success', label: 'Done' },
    scheduled: { tone: 'info', label: 'Scheduled' },
    due: { tone: 'warning', label: 'Due now' },
    behind: { tone: 'danger', label: 'Behind' },
    upcoming: { tone: 'outline', label: 'Upcoming' },
    skipped: { tone: 'neutral', label: 'Skipped' },
  };
  const m = map[state];
  return <Badge tone={m.tone} dot>{m.label}</Badge>;
}
