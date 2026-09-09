import { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, Info, TrendingDown } from 'lucide-react';
import { useStore } from '@/data/store';
import type { AppData } from '@/data/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Segmented, Progress, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, EmptyState } from '@/components/ui';
import { useLookups, ClientLink, DivisionBadge } from '@/components/shared';
import { revenueYtd, marginByDivision, marginByClient, marginByClientDivision, laborByJob, partsCost, type MarginRow } from '@/lib/metrics';
import { money, pct, cn, sum, daysBetween } from '@/lib/utils';

type Range = 'season' | 'last30';

function marginTone(m: number): 'success' | 'warning' | 'danger' {
  return m >= 0.3 ? 'success' : m >= 0.15 ? 'warning' : 'danger';
}
function marginText(m: number) {
  return m >= 0.3 ? 'text-success' : m >= 0.15 ? 'text-[hsl(30_70%_30%)]' : 'text-destructive';
}

export default function Reports() {
  const { data } = useStore();
  const { client } = useLookups();
  const [range, setRange] = useState<Range>('season');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filter completed jobs by range; metrics take a data object so we hand them a narrowed copy.
  const scoped: AppData = useMemo(() => {
    if (range === 'season') return data;
    return { ...data, jobs: data.jobs.filter((j) => j.status !== 'done' || (j.completedAt && daysBetween(j.completedAt.slice(0, 10), data.today) <= 30)) };
  }, [data, range]);

  const byDivision = useMemo(() => marginByDivision(scoped), [scoped]);
  const byClient = useMemo(() => marginByClient(scoped), [scoped]);
  const labor = useMemo(() => laborByJob(scoped), [scoped]);

  const totals = byDivision.reduce(
    (acc, r) => ({ revenue: acc.revenue + r.revenue, laborHours: acc.laborHours + r.laborHours, laborCost: acc.laborCost + r.laborCost, materialCost: acc.materialCost + r.materialCost, profit: acc.profit + r.profit }),
    { revenue: 0, laborHours: 0, laborCost: 0, materialCost: 0, profit: 0 },
  );
  const blended = totals.revenue ? totals.profit / totals.revenue : 0;
  const realized = totals.laborHours ? (totals.revenue - totals.materialCost) / totals.laborHours : 0;

  const installs = scoped.jobs.filter((j) => j.division === 'installs' && j.status === 'done');

  return (
    <div>
      <PageHeader
       
        title="Job Costing & Margins"
        subtitle="Margin by division, by client and by install. Check it before signing a multi-year term."
        actions={
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: 'season', label: 'Season to date' },
              { value: 'last30', label: 'Last 30 days' },
            ]}
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue (YTD collected)" value={money(revenueYtd(data), { cents: false })} sub={`${money(totals.revenue, { cents: false })} earned on completed work in range`} icon={<BarChart3 />} />
        <Stat label="Blended margin" value={pct(blended)} sub={`${money(totals.profit, { cents: false })} profit after labor & materials`} tone={marginTone(blended) === 'danger' ? 'danger' : marginTone(blended) === 'warning' ? 'warning' : 'success'} />
        <Stat label="Realized $ / labor hour" value={money(realized, { cents: false })} sub="Revenue less materials, per on-site hour" />
        <Stat label="Labor hours" value={totals.laborHours.toFixed(0)} sub={`${money(totals.laborCost, { cents: false })} loaded labor cost`} />
      </div>

      {/* Margin by division */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Margin by division</CardTitle>
          <CardDescription>Maintenance, irrigation, installs and backflow are really four businesses under one roof. Each gets its own scorecard.</CardDescription>
        </CardHeader>
        <CardContent>
          {byDivision.length === 0 ? (
            <EmptyState title="No completed work in range" />
          ) : (
            <div className="grid gap-px overflow-hidden rounded-lg bg-border/70 lg:grid-cols-2">
              {byDivision
                .slice()
                .sort((a, b) => b.revenue - a.revenue)
                .map((r) => (
                  <DivisionRow key={r.key} row={r} />
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Margin by client */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Margin by client</CardTitle>
          <CardDescription>Worst first. Click a row to see whether it was maintenance or irrigation that hurt.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-8" />
                <TH>Client</TH>
                <TH>Term</TH>
                <TH className="text-right">Revenue</TH>
                <TH className="text-right">Labor hrs</TH>
                <TH className="text-right">Margin</TH>
                <TH className="text-right">$ / hr</TH>
                <TH className="text-right">Profit</TH>
                <TH>Flag</TH>
              </TR>
            </THead>
            <TBody>
              {byClient.map((r) => {
                const c = client(r.key);
                const open = expanded === r.key;
                const since = c?.contractSince ? c.contractSince.slice(0, 4) : '';
                return (
                  <ClientRows key={r.key} row={r} open={open} onToggle={() => setExpanded(open ? null : r.key)} term={c ? `${c.termYears}-yr${since ? ` · since ${since}` : ''}` : ''} renewalDue={!!c?.tags.includes('Renewal due')} sub={open ? marginByClientDivision(scoped, r.key) : []} />
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Install breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Install project breakdown</CardTitle>
            <CardDescription>Which installs actually made money: heavy irrigation, hardscape, or plant-heavy jobs.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {installs.length === 0 ? (
              <div className="px-5 pb-4">
                <EmptyState title="No completed installs in range" />
              </div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Project</TH>
                    <TH className="text-right">Price</TH>
                    <TH className="text-right">Labor</TH>
                    <TH className="text-right">Materials</TH>
                    <TH className="text-right">Margin</TH>
                  </TR>
                </THead>
                <TBody>
                  {installs.map((j) => {
                    const lab = labor.get(j.id) ?? { hours: (j.laborMinutes ?? 0) / 60, cost: ((j.laborMinutes ?? 0) / 60) * 30 };
                    const mat = partsCost(scoped, j.partsUsed);
                    const profit = j.price - lab.cost - mat;
                    const m = j.price ? profit / j.price : 0;
                    return (
                      <TR key={j.id}>
                        <TD>
                          <div className="font-medium">{j.title}</div>
                          <div className="text-xs text-muted-foreground">
                            <ClientLink id={j.clientId} className="font-normal text-muted-foreground" /> · {lab.hours.toFixed(0)} crew hrs
                            {j.notes && <span> · {j.notes}</span>}
                          </div>
                        </TD>
                        <TD className="text-right num">{money(j.price, { cents: false })}</TD>
                        <TD className="text-right num">{money(lab.cost, { cents: false })}</TD>
                        <TD className="text-right num">{mat ? money(mat, { cents: false }) : <span className="text-muted-foreground">tracked off-catalog</span>}</TD>
                        <TD className={cn('text-right font-semibold num', marginText(m))}>{pct(m)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
            <p className="px-5 pt-3 text-xs text-muted-foreground">Plant material and hardscape bought outside the parts catalog is not yet costed here; the production build will pull it from vendor invoices so each install splits into irrigation / hardscape / plants.</p>
          </CardContent>
        </Card>

        {/* Methodology */}
        <div className="rounded-lg bg-muted/50 p-5">
          <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Info className="size-4 text-muted-foreground" /> How labor is attributed
          </div>
          <div className="space-y-3 text-[13.5px]">
            <p>
              <span className="font-medium">Geofence visits</span> log arrive and depart at each property with nobody tapping a button. A visit's hours are split evenly across the jobs worked during it.
            </p>
            <p>
              <span className="font-medium">Mowing baseline:</span> mid-summer weeks with mowing only give the true mow time per property.
            </p>
            <p>
              <span className="font-medium">Cleanup / pruning overage:</span> on combo days, day hours minus the mowing baseline is attributed to the cleanup or pruning line. This is the same method as your spreadsheet, run automatically.
            </p>
            <p className="text-xs text-muted-foreground">Loaded labor rates come from Team. Materials come from parts logged on work orders at cost.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DivisionRow({ row }: { row: MarginRow }) {
  const tone = marginTone(row.margin);
  return (
    <div className="bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DivisionBadge division={row.key as 'maintenance' | 'irrigation' | 'installs' | 'backflow'} />
          <span className="text-xs text-muted-foreground">{row.jobs} jobs</span>
        </div>
        <div className={cn('num text-lg font-semibold', marginText(row.margin))}>{pct(row.margin)}</div>
      </div>
      <Progress value={Math.max(0, row.margin)} tone={tone} />
      <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
        <Cell label="Revenue" value={money(row.revenue, { cents: false })} />
        <Cell label="Labor" value={`${row.laborHours.toFixed(0)} h · ${money(row.laborCost, { cents: false })}`} />
        <Cell label="Materials" value={money(row.materialCost, { cents: false })} />
        <Cell label="Profit" value={money(row.profit, { cents: false })} strong />
        <Cell label="$ / labor hr" value={money(row.realizedHourly, { cents: false })} />
      </div>
    </div>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[11.5px] font-medium text-muted-foreground">{label}</div>
      <div className={cn('tabular', strong && 'font-semibold')}>{value}</div>
    </div>
  );
}

function ClientRows({ row, open, onToggle, term, renewalDue, sub }: { row: MarginRow; open: boolean; onToggle: () => void; term: string; renewalDue: boolean; sub: MarginRow[] }) {
  const low = row.margin < 0.15;
  return (
    <>
      <TR onClick={onToggle} className="cursor-pointer">
        <TD className="text-muted-foreground">{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</TD>
        <TD>
          <ClientLink id={row.key} />
          <div className="text-xs text-muted-foreground">{row.jobs} jobs</div>
        </TD>
        <TD className="whitespace-nowrap text-muted-foreground">{term}</TD>
        <TD className="text-right num">{money(row.revenue, { cents: false })}</TD>
        <TD className="text-right num">{row.laborHours.toFixed(0)}</TD>
        <TD className={cn('text-right font-semibold num', marginText(row.margin))}>{pct(row.margin)}</TD>
        <TD className="text-right num">{money(row.realizedHourly, { cents: false })}</TD>
        <TD className="text-right num">{money(row.profit, { cents: false })}</TD>
        <TD>
          <div className="flex flex-wrap gap-1">
            {low && (
              <Badge tone="danger">
                <TrendingDown className="size-3" /> Investigate before renewal
              </Badge>
            )}
            {renewalDue && <Badge tone="warning">Renewal due</Badge>}
          </div>
        </TD>
      </TR>
      {open &&
        sub.map((s) => (
          <TR key={s.key} className="bg-muted/30">
            <TD />
            <td colSpan={2} className="px-3 py-2.5 pl-6 align-middle">
              <DivisionBadge division={s.key as 'maintenance' | 'irrigation' | 'installs' | 'backflow'} />
              <span className="ml-2 text-xs text-muted-foreground">{s.jobs} jobs</span>
            </td>
            <TD className="text-right num">{money(s.revenue, { cents: false })}</TD>
            <TD className="text-right num">{s.laborHours.toFixed(0)}</TD>
            <TD className={cn('text-right font-semibold num', marginText(s.margin))}>{pct(s.margin)}</TD>
            <TD className="text-right num">{money(s.realizedHourly, { cents: false })}</TD>
            <TD className="text-right num">{money(s.profit, { cents: false })}</TD>
            <TD className="text-xs text-muted-foreground">{s.margin < 0.15 ? 'This is where it slipped' : ''}</TD>
          </TR>
        ))}
      {open && sub.length === 0 && (
        <TR className="bg-muted/30">
          <TD />
          <td colSpan={8} className="px-3 py-2.5 text-sm text-muted-foreground">
            No division detail available.
          </td>
        </TR>
      )}
    </>
  );
}

// keep sum referenced for potential future totals (avoids unused import lint in some setups)
void sum;
