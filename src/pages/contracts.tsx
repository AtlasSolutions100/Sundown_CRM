import { useMemo, useState } from 'react';
import { Download, ChevronDown, ChevronRight, ClipboardCheck, Search } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardContent, Badge, Input, Select, Field, Dialog, Segmented, Progress, MilestoneBar, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, EmptyState, useToast, type Tone } from '@/components/ui';
import { useLookups, ClientLink, StatePill, CrewChip } from '@/components/shared';
import { allContractProgress, type ContractProgress, type LineProgress, type LineState } from '@/lib/metrics';
import { money, fmtDate, sum, cn } from '@/lib/utils';

type Filter = 'all' | 'behind' | 'due' | 'on_track' | 'complete';

const LINE_TONE: Record<LineState, Tone | 'empty'> = {
  done: 'success',
  behind: 'danger',
  due: 'warning',
  scheduled: 'info',
  upcoming: 'empty',
  skipped: 'neutral',
};

const INV_TONE: Record<LineProgress['invoiceState'], Tone> = { none: 'outline', pending: 'accent', sent: 'info', paid: 'success', overdue: 'danger' };
const INV_LABEL: Record<LineProgress['invoiceState'], string> = { none: 'Not invoiced', pending: 'Needs approval', sent: 'Invoiced', paid: 'Paid', overdue: 'Overdue' };

export default function Contracts() {
  const { data, actions } = useStore();
  const { service, crew } = useLookups();
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [svcFilter, setSvcFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<{ jobId: string; title: string } | null>(null);
  const [schedDate, setSchedDate] = useState(data.today);
  const [schedCrew, setSchedCrew] = useState(data.crews[0]?.id ?? '');

  const progress = useMemo(() => allContractProgress(data), [data]);

  const filtered = progress.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (svcFilter !== 'all' && !p.byService.some((s) => s.serviceId === svcFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.client.name.toLowerCase().includes(q) && !p.property.name.toLowerCase().includes(q) && !p.property.city.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalLines = sum(progress.map((p) => p.total));
  const doneLines = sum(progress.map((p) => p.done));
  const remaining = sum(progress.map((p) => p.valueRemaining));
  const behindCount = progress.filter((p) => p.behind > 0).length;

  const exportCsv = () => {
    const rows = [['Client', 'Property', 'Service', 'Item', 'Window start', 'Window end', 'State', 'Days behind', 'Price']];
    for (const p of progress) {
      for (const l of p.lines) rows.push([p.client.name, p.property.name, service(l.serviceId)?.name ?? l.serviceId, l.label, l.windowStart, l.windowEnd, l.state, String(l.daysBehind), l.price.toFixed(2)]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sundown-completion-audit-${data.today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Audit exported', description: `${rows.length - 1} contract lines.` });
  };

  const openSchedule = (jobId: string, title: string) => {
    setSchedDate(data.today);
    setScheduling({ jobId, title });
  };
  const confirmSchedule = () => {
    if (!scheduling) return;
    actions.scheduleJob(scheduling.jobId, schedDate, schedCrew);
    toast({ title: 'Scheduled', description: `${scheduling.title} → ${fmtDate(schedDate)} · ${crew(schedCrew)?.name}` });
    setScheduling(null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Sold vs. done"
        title="Completion Audit"
        subtitle="Every contracted service for the season, live. Farthest overdue floats to the top so the week plans itself."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download /> Export audit (CSV)
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active contracts" value={progress.length} sub={`${data.contracts.length} total on file`} />
        <Stat label="Items complete" value={`${doneLines}/${totalLines}`} sub={totalLines ? `${Math.round((doneLines / totalLines) * 100)}% of season` : ''} tone="success" />
        <Stat label="Still on the table" value={money(remaining, { cents: false })} sub="Contracted work not yet done" tone="accent" />
        <Stat label="Behind" value={behindCount} sub={behindCount ? `${sum(progress.map((p) => p.behind))} items past window` : 'Nothing overdue'} tone={behindCount ? 'danger' : 'success'} />
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All (${progress.length})` },
            { value: 'behind', label: `Behind (${progress.filter((p) => p.status === 'behind').length})` },
            { value: 'due', label: `Due now (${progress.filter((p) => p.status === 'due').length})` },
            { value: 'on_track', label: `On track (${progress.filter((p) => p.status === 'on_track').length})` },
            { value: 'complete', label: `Complete (${progress.filter((p) => p.status === 'complete').length})` },
          ]}
        />
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search client or property" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 pl-8" />
          </div>
          <Select value={svcFilter} onChange={(e) => setSvcFilter(e.target.value)} className="w-48">
            <option value="all">All services</option>
            {data.services.filter((s) => s.category === 'routine').map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <Legend tone="bg-success" label="Done" />
        <Legend tone="bg-info" label="Scheduled" />
        <Legend tone="bg-warning" label="Due now" />
        <Legend tone="bg-destructive" label="Behind (window closed)" />
        <Legend tone="bg-muted border" label="Upcoming" />
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 && <EmptyState icon={<ClipboardCheck />} title="No contracts match" description="Try a different filter or search." />}
        {filtered.map((p) => (
          <ContractCard
            key={p.contract.id}
            p={p}
            expanded={expanded === p.contract.id}
            onToggle={() => setExpanded(expanded === p.contract.id ? null : p.contract.id)}
            onSchedule={openSchedule}
            onDone={(jobId, title) => {
              actions.setJobStatus(jobId, 'done');
              toast({ title: 'Marked done', description: title });
            }}
          />
        ))}
      </div>

      <Dialog
        open={!!scheduling}
        onClose={() => setScheduling(null)}
        title="Schedule item"
        description={scheduling?.title}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setScheduling(null)}>Cancel</Button>
            <Button onClick={confirmSchedule}>Put on schedule</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
          </Field>
          <Field label="Crew">
            <Select value={schedCrew} onChange={(e) => setSchedCrew(e.target.value)}>
              {data.crews.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-4 rounded-sm', tone)} /> {label}
    </span>
  );
}

function StatusBadge({ p }: { p: ContractProgress }) {
  if (p.status === 'behind') return <Badge tone="danger" dot>{p.worstDaysBehind}d behind · {p.behind} item{p.behind === 1 ? '' : 's'}</Badge>;
  if (p.status === 'due') return <Badge tone="warning" dot>Due now · {p.due} item{p.due === 1 ? '' : 's'}</Badge>;
  if (p.status === 'complete') return <Badge tone="neutral" dot>Complete</Badge>;
  return <Badge tone="success" dot>On track</Badge>;
}

function ContractCard({ p, expanded, onToggle, onSchedule, onDone }: { p: ContractProgress; expanded: boolean; onToggle: () => void; onSchedule: (jobId: string, title: string) => void; onDone: (jobId: string, title: string) => void }) {
  const { service, crew } = useLookups();
  const ratio = p.total ? p.done / p.total : 0;
  const barTone = p.status === 'behind' ? 'danger' : p.status === 'due' ? 'warning' : p.status === 'complete' ? 'primary' : 'success';

  return (
    <Card className={cn(p.status === 'behind' && 'border-destructive/40')}>
      <button type="button" onClick={onToggle} className="w-full text-left">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <span className="mt-0.5 text-muted-foreground">{expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span onClick={(e) => e.stopPropagation()}>
                    <ClientLink id={p.client.id} className="text-base font-semibold" />
                  </span>
                  <Badge tone="outline">{p.contract.termYears}-yr term</Badge>
                  <StatusBadge p={p} />
                </div>
                <div className="text-sm text-muted-foreground">
                  {p.property.name} · {p.property.city} · {money(p.valueDone, { cents: false })} of {money(p.valueTotal, { cents: false })} delivered
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 md:w-72">
              <div className="text-right">
                <div className="text-2xl font-bold tabular leading-none">
                  {p.done}<span className="text-base font-medium text-muted-foreground">/{p.total}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">items done</div>
              </div>
              <Progress value={ratio} tone={barTone} height="h-2.5" className="flex-1" />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
            {p.byService.map((s) => {
              const lines = p.lines.filter((l) => l.serviceId === s.serviceId);
              return (
                <div key={s.serviceId}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn('truncate font-medium', s.behind > 0 && 'text-destructive')}>{s.name}</span>
                    <span className="tabular text-muted-foreground">{s.done}/{s.total}</span>
                  </div>
                  <MilestoneBar className="mt-1" cells={lines.map((l) => ({ tone: LINE_TONE[l.state], title: `${l.label} · ${fmtDate(l.windowStart)}–${fmtDate(l.windowEnd)} · ${l.state}${l.daysBehind ? ` (${l.daysBehind}d)` : ''}` }))} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t">
          <Table>
            <THead>
              <TR>
                <TH>Service</TH>
                <TH>Item</TH>
                <TH>Window</TH>
                <TH>State</TH>
                <TH>Scheduled</TH>
                <TH className="text-right">Price</TH>
                <TH>Invoice</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {[...p.lines]
                .sort((a, b) => a.windowStart.localeCompare(b.windowStart))
                .map((l) => {
                  const job = l.job;
                  const title = `${service(l.serviceId)?.name} – ${l.label}`;
                  return (
                    <TR key={l.lineId} className={cn(l.state === 'behind' && 'bg-destructive/5')}>
                      <TD className="font-medium">{service(l.serviceId)?.name}</TD>
                      <TD>{l.label}</TD>
                      <TD className="whitespace-nowrap text-muted-foreground">{fmtDate(l.windowStart)} – {fmtDate(l.windowEnd)}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <StatePill state={l.state} />
                          {l.daysBehind > 0 && <span className="text-xs text-destructive">{l.daysBehind}d</span>}
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {job?.scheduledDate ? (
                          <div className="flex flex-col">
                            <span>{fmtDate(job.status === 'done' ? (job.completedAt ?? job.scheduledDate) : job.scheduledDate)}</span>
                            <CrewChip crewId={job.crewId} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                      <TD className="text-right tabular">{money(l.price)}</TD>
                      <TD>
                        <Badge tone={INV_TONE[l.invoiceState]}>{INV_LABEL[l.invoiceState]}</Badge>
                      </TD>
                      <TD className="text-right">
                        {job && (l.state === 'behind' || l.state === 'due' || l.state === 'upcoming') && (
                          <Button size="xs" variant={l.state === 'behind' ? 'primary' : 'outline'} onClick={() => onSchedule(job.id, title)}>
                            Schedule
                          </Button>
                        )}
                        {job && l.state === 'scheduled' && (
                          <Button size="xs" variant="success" onClick={() => onDone(job.id, title)}>
                            Mark done
                          </Button>
                        )}
                        {job && l.state === 'done' && crew(job.crewId) === undefined && null}
                      </TD>
                    </TR>
                  );
                })}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
