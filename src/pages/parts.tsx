import { useMemo, useState } from 'react';
import { Package, Plus, RefreshCw, Percent, CalendarCheck, ShoppingCart } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardContent, Badge, Input, Select, Field, Dialog, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, EmptyState, useToast } from '@/components/ui';
import { partSellPrice, round2 } from '@/lib/pricing';
import { money, fmtDateLong, sum, uid } from '@/lib/utils';
import type { Part } from '@/data/types';

export default function Parts() {
  const { data, update, actions } = useStore();
  const toast = useToast();
  const [markup, setMarkup] = useState(data.settings.defaultMarkupPct);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [priceUpdate, setPriceUpdate] = useState<{ part: Part; oldCost: number; newCost: number }[] | null>(null);

  const categories = [...new Set(data.parts.map((p) => p.category))].sort();
  const doneJobs = data.jobs.filter((j) => j.status === 'done');
  const month = data.today.slice(0, 7);
  const usedYtd = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of doneJobs) for (const u of j.partsUsed) m.set(u.partId, (m.get(u.partId) ?? 0) + u.qty);
    return m;
  }, [doneJobs]);
  const usedThisMonth = sum(
    doneJobs
      .filter((j) => j.completedAt?.startsWith(month))
      .flatMap((j) => j.partsUsed.map((u) => {
        const p = data.parts.find((x) => x.id === u.partId);
        return p ? partSellPrice(p) * u.qty : 0;
      })),
  );
  const avgMarkup = data.parts.length ? sum(data.parts.map((p) => p.markupPct)) / data.parts.length : 0;
  const lastCheck = data.parts.map((p) => p.lastPriceCheck).sort().at(-1);

  const rows = data.parts.filter((p) => (category === 'all' || p.category === category) && (!search || [p.sku, p.name, p.category].some((s) => s.toLowerCase().includes(search.toLowerCase()))));

  const simulate = () => {
    const pool = [...data.parts].sort(() => Math.random() - 0.5).slice(0, 3);
    setPriceUpdate(pool.map((part) => ({ part, oldCost: part.cost, newCost: round2(part.cost * (1 + (4 + Math.random() * 5) / 100)) })));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Parts & pricing"
        subtitle="SiteOne price list with your markup. Techs pick parts from the bucket count; work orders and invoices price themselves."
        actions={
          <>
            <Button variant="outline" onClick={simulate}><RefreshCw /> Simulate SiteOne price update</Button>
            <Button onClick={() => setAdding(true)}><Plus /> Add part</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Parts in catalog" value={data.parts.length} icon={<Package />} />
        <Stat label="Average markup" value={`${avgMarkup.toFixed(0)}%`} icon={<Percent />} />
        <Stat label="Last price check" value={lastCheck ? fmtDateLong(lastCheck) : '—'} icon={<CalendarCheck />} />
        <Stat label="Parts billed this month" value={money(usedThisMonth)} tone="accent" icon={<ShoppingCart />} />
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <Field label="Default markup %" hint="Applied to new parts and on bulk apply">
            <Input type="number" className="w-28" value={markup} onChange={(e) => setMarkup(Number(e.target.value))} />
          </Field>
          <Button
            variant="secondary"
            onClick={() => {
              actions.bulkMarkup(markup);
              toast({ title: `Markup set to ${markup}% on every part` });
            }}
          >
            Apply to all parts
          </Button>
          <p className="max-w-md text-xs text-muted-foreground">Nice-to-have later: sync your SiteOne account pricing nightly and flag anything that moved so you can accept the new sell price in one click.</p>
        </CardContent>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Input placeholder="Search SKU or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </div>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6"><EmptyState icon={<Package />} title="No parts match" /></div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>SKU</TH>
                  <TH>Part</TH>
                  <TH>Category</TH>
                  <TH>Supplier</TH>
                  <TH>Unit</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Markup %</TH>
                  <TH className="text-right">Sell</TH>
                  <TH className="text-right">Used YTD</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs">{p.sku}</TD>
                    <TD className="font-medium">{p.name}</TD>
                    <TD><Badge tone="outline">{p.category}</Badge></TD>
                    <TD className="text-sm text-muted-foreground">{p.supplier}</TD>
                    <TD className="text-sm text-muted-foreground">{p.unit}</TD>
                    <TD className="text-right">
                      <Input type="number" step="0.01" value={p.cost} onChange={(e) => actions.updatePart(p.id, { cost: Number(e.target.value) })} className="ml-auto h-8 w-24 text-right tabular" />
                    </TD>
                    <TD className="text-right">
                      <Input type="number" step="5" value={p.markupPct} onChange={(e) => actions.updatePart(p.id, { markupPct: Number(e.target.value) })} className="ml-auto h-8 w-20 text-right tabular" />
                    </TD>
                    <TD className="text-right tabular font-semibold text-primary">{money(partSellPrice(p))}</TD>
                    <TD className="text-right tabular text-muted-foreground">{usedYtd.get(p.id) ?? 0}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {adding && (
        <AddPartDialog
          defaultMarkup={markup}
          onClose={() => setAdding(false)}
          onSave={(p) => {
            update((d) => {
              d.parts.push(p);
            });
            toast({ title: 'Part added', description: `${p.name} · sells at ${money(partSellPrice(p))}` });
            setAdding(false);
          }}
        />
      )}

      {priceUpdate && (
        <Dialog
          open
          onClose={() => setPriceUpdate(null)}
          title="Prices changed at SiteOne"
          description="Accept the new costs and your sell prices update at the same markup."
          footer={
            <>
              <Button variant="outline" onClick={() => setPriceUpdate(null)}>Ignore</Button>
              <Button
                onClick={() => {
                  update((d) => {
                    for (const u of priceUpdate) {
                      const p = d.parts.find((x) => x.id === u.part.id);
                      if (p) {
                        p.cost = u.newCost;
                        p.lastPriceCheck = d.today;
                      }
                    }
                  });
                  toast({ title: `${priceUpdate.length} prices updated` });
                  setPriceUpdate(null);
                }}
              >
                Accept new prices
              </Button>
            </>
          }
        >
          <Table>
            <THead>
              <TR><TH>Part</TH><TH className="text-right">Old cost</TH><TH className="text-right">New cost</TH><TH className="text-right">Old sell</TH><TH className="text-right">New sell</TH></TR>
            </THead>
            <TBody>
              {priceUpdate.map((u) => (
                <TR key={u.part.id}>
                  <TD className="font-medium">{u.part.name}</TD>
                  <TD className="text-right tabular text-muted-foreground">{money(u.oldCost)}</TD>
                  <TD className="text-right tabular font-semibold">{money(u.newCost)} <span className="text-xs text-destructive">+{(((u.newCost - u.oldCost) / u.oldCost) * 100).toFixed(1)}%</span></TD>
                  <TD className="text-right tabular text-muted-foreground">{money(partSellPrice({ cost: u.oldCost, markupPct: u.part.markupPct }))}</TD>
                  <TD className="text-right tabular font-semibold text-primary">{money(partSellPrice({ cost: u.newCost, markupPct: u.part.markupPct }))}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Dialog>
      )}
    </div>
  );
}

function AddPartDialog({ defaultMarkup, onClose, onSave }: { defaultMarkup: number; onClose: () => void; onSave: (p: Part) => void }) {
  const { data } = useStore();
  const [f, setF] = useState({ sku: '', name: '', category: 'Fittings', cost: 0, markupPct: defaultMarkup, supplier: 'SiteOne' as Part['supplier'], unit: 'ea' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add part"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!f.name.trim() || !f.sku.trim()} onClick={() => onSave({ id: uid('pt'), ...f, lastPriceCheck: data.today })}>Add</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SKU"><Input value={f.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
        <Field label="Category"><Input value={f.category} onChange={(e) => set('category', e.target.value)} list="part-cats" /></Field>
        <datalist id="part-cats">{[...new Set(data.parts.map((p) => p.category))].map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Cost ($)"><Input type="number" step="0.01" value={f.cost} onChange={(e) => set('cost', Number(e.target.value))} /></Field>
        <Field label="Markup %"><Input type="number" value={f.markupPct} onChange={(e) => set('markupPct', Number(e.target.value))} /></Field>
        <Field label="Supplier">
          <Select value={f.supplier} onChange={(e) => set('supplier', e.target.value as Part['supplier'])}>
            <option>SiteOne</option>
            <option>Home Depot</option>
            <option>Other</option>
          </Select>
        </Field>
        <Field label="Unit"><Input value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="ea / ft" /></Field>
        <div className="rounded-md border bg-muted/30 p-3 text-sm sm:col-span-2">Sells at <span className="font-semibold tabular text-primary">{money(partSellPrice({ cost: f.cost, markupPct: f.markupPct }))}</span></div>
      </div>
    </Dialog>
  );
}
